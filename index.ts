import express, { Router } from "express";
import { requiresAuth, ConfigParams, auth } from "express-openid-connect";

const router = Router();
const app = express();

app.set('view engine', 'pug')

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

// Declare a route
app.get("/", async (req, res) => {
  const user = req.oidc.user;
  return res.render("index.pug", {
    user,
    authServer: authServer,
  });
});

// Run the server!
app.listen({ port: 3000 }, () => {
  console.log("Server podignut")
});
