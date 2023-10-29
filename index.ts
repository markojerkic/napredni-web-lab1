import express from "express";
import { ConfigParams, auth, requiresAuth } from "express-openid-connect";
import fs from "node:fs";
import https from "node:https";
import bodyParser from "body-parser";
import { object, parse, regex, string } from "valibot";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { Competition, Game, GameType } from "./src/schema";
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

  const competition = await db
    .insert(Competition)
    .values({
      ownerId: req.oidc.user!.sid,
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

app.get("/competition/:id", async (req, res) => {
  console.log("Natjecanje", req.params.id);
  const [competition, games] = await Promise.all([db
    .select()
    .from(Competition)
    .where(eq(Competition.id, +req.params.id)).then(c => c[0]),

  db.select().from(Game).where(eq(Game.competitionId, +req.params.id))]);

  return res.render("competition.pug", {
    competition, games
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
