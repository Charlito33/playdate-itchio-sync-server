let utils = require("./utils.js");
let itch = require("./itchio.js");
let playdate = require("./playdate.js");

const express = require("express");
const app = express();

const bodyParser = require("body-parser");
app.use(bodyParser.raw({extended: true}));
app.use(bodyParser.json());

const cors = require('cors');
app.use(cors());

const mysql = require("mysql");
const util = require("util");
const {CookieJar} = require("jsdom");
const conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "playdate_itchio_sync_server"
});
const query = util.promisify(conn.query).bind(conn); // For await

conn.connect(function(err) {
    if (err) {
        console.error("Can't connect to the Database !");
        console.error(err.sqlMessage);
        process.exit(1);
    }
});

const port = 8000;
const server = app.listen(port, () => console.log(`PlayDate Itch.io Sync Server is listening on port ${port} !`));

app.post("/auth", async (req, res) => {
    if (!utils.isSet(req.body.playdate, req.body.itch)) {
        res.status(400);
        return res.end();
    }

    let playdateUsername = req.body.playdate.username;
    let playdatePassword = req.body.playdate.password;
    let itchUsername = req.body.itch.username;
    let itchPassword = req.body.itch.password;

    if (!utils.isSet(playdateUsername, playdatePassword, itchUsername, itchPassword)) {
        res.status(400);
        return res.end();
    }

    let itchLogin = await itch.login(itchUsername, itchPassword);
    if (utils.isSet(itchLogin.errors)) {
        res.status(400);
        res.json({
            "errors": {
                "itch": itchLogin.errors
            }
        })
        return res.end();
    }

    let playdateCookieJar = await playdate.login(playdateUsername, playdatePassword);
    let playdateCookieString = await playdateCookieJar.getCookieString("https://play.date/");
    let playdateCookies = utils.parseCookieString(playdateCookieString);

    if (!utils.isSet(playdateCookies.csrftoken, playdateCookies.sessionid)) {
        res.status(400);
        res.json({
            "error": "auth_error",
            "error_message": "Authentication error, please check your credentials"
        })
        return res.end();
    }

    let [err, token] = await utils.generateAuthToken(query, res, playdateCookieString);

    if (err) {
        return;
    }

    res.json({
        "auth_token": token
    });
});

app.post("/auth/revoke", async (req, res) => {
    if (!utils.isSet(req.body.token)) {
        res.status(400);
        return res.end();
    }

    let tokenID;
    if (utils.isSet(req.body.only_id) && req.body.only_id) {
        tokenID = req.body.token;
    } else {
        tokenID = utils.decodeToken(req.body.token).tokenID;
    }

    if (tokenID.length !== 32) {
        res.status(400);
        res.json({
            "error": "invalid_token_length",
            "error_message": "Token length is incorrect"
        });
        return res.end();
    }

    let err, rows = await query("DELETE FROM auth_tokens WHERE token_id = ?", [tokenID]);

    if (err) {
        console.error(err);
        res.status(400);
        res.json(err);
        return res.end();
    }

    if (rows.affectedRows > 0) {
        res.json({
            "message": "Token revoked"
        });
    } else {
        res.status(400);
        res.json({
            "error": "invalid_token",
            "error_message": "Token is invalid"
        });
        return res.end();
    }
});

app.get("/sideload/list", async (req, res) => {
    let [err, token] = await utils.checkAuthToken(query, req, res);

    if (err) {
        return; // Response is already ended, no need to end it
    }

    let [err1, cookieString] = await utils.getCookieString(query, res, token);

    if (err1) {
        return;
    }

    const jar = new CookieJar();

    let cookieStringArray = cookieString.split(";");
    for (let i = 0; i < cookieStringArray.length; i++) {
        let cookie = cookieStringArray[i].trim();
        await jar.setCookie(cookie, "https://play.date/");
    }

    // THAT'S FUCK*NG AWESOME ! IT'S WORKING
    const sideloads = await playdate.getSideloads(jar);

    res.json({
        "games": sideloads
    });
});

