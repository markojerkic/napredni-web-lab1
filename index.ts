import express from "express";
import { ConfigParams, auth, requiresAuth } from "express-openid-connect";
import fs from "node:fs";
import https from "node:https";
import bodyParser from "body-parser";
import { enumType, object, parse, record, string } from "valibot";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { Competition, Game, Winner } from "./src/schema";
import { eq } from "drizzle-orm";

const sql = postgres(process.env.DB_URL!, { ssl: true });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "drizzle" });

const app = express();

app.set("view engine", "pug");

const externalUrl = process.env.RENDER_EXTERNAL_URL;
const port =
  externalUrl && process.env.PORT ? parseInt(process.env.PORT) : 4080;

const authServer = process.env.ISSUER_BASE_URL!;
const config: ConfigParams = {
  authRequired: false,
  auth0Logout: true,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.SECRET,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
};

app.use(auth(config));
app.use(bodyParser.urlencoded({ extended: false }));

const winTypeRegex = new RegExp("\\d+\\/\\d+\\/\\d+");
const SaveDataSchema = object({
  name: string(),
  playerList: string(),
  winType: string(),
});

const generatePair = (players: string[]) => {
  const pairs: string[][] = [];

  pairs.push([players[0], players[1]]);
  pairs.push([players[0], players[2]]);
  pairs.push([players[0], players[3]]);

  pairs.push([players[1], players[2]]);

  pairs.push([players[1], players[3]]);
  pairs.push([players[2], players[3]]);

  if (players.length > 4) {
    pairs.push([players[0], players[4]]);
    pairs.push([players[1], players[4]]);
    pairs.push([players[2], players[4]]);
    pairs.push([players[3], players[4]]);

    pairs.push([players[0], players[5]]);
    pairs.push([players[1], players[5]]);
    pairs.push([players[2], players[5]]);
    pairs.push([players[3], players[5]]);
    pairs.push([players[4], players[5]]);
  }

  if (players.length === 8) {
    pairs.push([players[0], players[6]]);
    pairs.push([players[1], players[6]]);
    pairs.push([players[2], players[6]]);
    pairs.push([players[3], players[6]]);
    pairs.push([players[4], players[6]]);
    pairs.push([players[5], players[6]]);

    pairs.push([players[0], players[7]]);
    pairs.push([players[1], players[7]]);
    pairs.push([players[2], players[7]]);
    pairs.push([players[3], players[7]]);
    pairs.push([players[4], players[7]]);
    pairs.push([players[5], players[7]]);
    pairs.push([players[6], players[7]]);
  }

  return pairs;
};

app.get("/", async (req, res) => {
  const user = req.oidc.user;
  console.log("user", req.oidc.user);
  return res.render("index.pug", {
    user: user?.name,
  });
});

app.post("/save", requiresAuth(), async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    res.redirect("/login");
  }
  const data = parse(SaveDataSchema, req.body);
  if (!winTypeRegex.test(data.winType))
    throw new Error("Win type not formated correctly");
  const players = data.playerList.split(/[\,\n]+/);
  if (players.length !== 4 && players.length !== 6 && players.length !== 8)
    throw new Error("Podržano samo između 4 i 8 natjecatelja");

  const points = data.winType.split("/").map(Number);

  const competition = await db
    .insert(Competition)
    .values({
      winPoints: `${points[0]!}`,
      drawPoints: `${points[1]!}`,
      lossPoints: `${points[2]!}`,
      ownerId: req.oidc.user!.sid as string,
      name: data.name,
    })
    .returning();

  const competitionId = competition[0].id;

  const matches = generatePair(players).map((pair) => ({
    competitionId,
    homeTeam: pair[0],
    awayTeam: pair[1],
  }));

  await db.insert(Game).values(matches);

  return res.redirect(`/competition/${competitionId}`);
});

const GameEditObject = record(enumType(Winner.enumValues))
app.post("/competition/:id/edit", async (req, res) => {
  const competition = await db
    .select()
    .from(Competition)
    .where(eq(Competition.id, +req.params.id))
    .then((c) => c[0]);
  const isOwner = competition.ownerId === req.oidc.user?.sid;
  if (!isOwner) {
    return res.redirect("/");
  }

  const data = parse(GameEditObject, req.body);
  await Promise.all(Object.entries(data).map(entry =>
    db.update(Game).set({ winner: entry[1] }).where(eq(Game.id, +entry[0]))
  ));

  return res.redirect(`/competition/${competition.id}`);
});

app.get("/competition/:id/edit", async (req, res) => {
  const [competition, games] = await Promise.all([
    db
      .select()
      .from(Competition)
      .where(eq(Competition.id, +req.params.id))
      .then((c) => c[0]),

    db.select().from(Game).where(eq(Game.competitionId, +req.params.id)),
  ]);
  const isOwner = competition.ownerId === req.oidc.user?.sid;
  if (!isOwner) {
    return res.redirect("/");
  }
  return res.render("edit.pug", {
    competition,
    games,
  });
});

app.get("/competition/:id", async (req, res) => {
  console.log("Natjecanje", req.params.id);
  console.log("tu smo")
  const [competition, games] = await Promise.all([
    db
      .select()
      .from(Competition)
      .where(eq(Competition.id, +req.params.id))
      .then((c) => c[0]),

    db
      .select()
      .from(Game)
      .where(eq(Game.competitionId, +req.params.id))
      .then((games) =>
        games.map((game) => ({
          ...game,
          homeTeamColor:
            game.winner === "home"
              ? "bg-blue-200"
              : game.winner === "draw"
                ? "bg-yellow-200"
                : "bg-red-200",
          awayTeamColor:
            game.winner === "away"
              ? "bg-blue-200"
              : game.winner === "draw"
                ? "bg-yellow-200"
                : "bg-red-200",
        })),
      ),
  ]);

  const teams: Map<string, { name: string, points: number, wins: number, draws: number, losses: number }> = new Map();

  for (let game of games) {
    let homeTeam = teams.get(game.homeTeam);

    let homePoints = 0;
    if (game.winner === "home") {
      homePoints = +competition.winPoints;
    } else if (game.winner === "draw") {
      homePoints = +competition.drawPoints;
    } else if (game.winner === "away") {
      homePoints = +competition.lossPoints;
    }

    let awayPoints = 0;
    if (game.winner === "away") {
      awayPoints = +competition.winPoints;
    } else if (game.winner === "draw") {
      awayPoints = +competition.drawPoints;
    } else if (game.winner === "home") {
      awayPoints = +competition.lossPoints;
    }

    if (!homeTeam) {

      homeTeam = {
        name: game.homeTeam,
        points: homePoints,
        wins: game.winner === "home" ? 1 : 0,
        draws: game.winner === "draw" ? 1 : 0,
        losses: game.winner === "away" ? 1 : 0
      }
      teams.set(game.homeTeam, homeTeam);
    } else {
      homeTeam.points += homePoints;
    }

    let awayTeam = teams.get(game.awayTeam);
    if (!awayTeam) {
      awayTeam = {
        name: game.awayTeam,
        points: homePoints,
        wins: game.winner === "away" ? 1 : 0,
        draws: game.winner === "draw" ? 1 : 0,
        losses: game.winner === "home" ? 1 : 0
      }
      teams.set(game.awayTeam, awayTeam);
    } else {
      awayTeam.points += awayPoints;
    }

  }

  const table = Object.values(Object.fromEntries(teams.entries()))
  table.sort((a, b) => {
    if (a.points > b.points) return -1;
    if (a.points === b.points) return 0;
    return 1;
  })

  const isOwner = competition.ownerId === req.oidc.user?.sid;
  return res.render("competition.pug", {
    competition,
    games,
    isOwner,
    teamsTable: table,
  });
});

if (externalUrl) {
  const hostname = "0.0.0.0"; //ne 127.0.0.1
  app.listen(port, hostname, () => {
    console.log(
      `Server locally running at http://${hostname}:${port}/ and from outside on ${externalUrl}`,
    );
  });
} else {
  https
    .createServer(
      {
        key: fs.readFileSync("server.key"),
        cert: fs.readFileSync("server.cert"),
      },
      app,
    )
    .listen(port, function() {
      console.log(`Server running at https://localhost:${port}/`);
    });
}
