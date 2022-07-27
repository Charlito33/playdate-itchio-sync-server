const crypto = require("./crypto.js");
const {decrypt} = require("./crypto");
const {auth, token} = require("mysql/lib/protocol/Auth");
const util = require("util");

function isSet(/**/) {
    let args = arguments;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === undefined) return false;
        if (typeof(args[i]) === "undefined") return false;
    }

    return true;
}

function parseCookieString(str) {
    let cookies = str.split(";");
    let cookiesArray = {};

    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim().split("=");
        cookiesArray[cookie[0]] = cookie[1];
    }

    return cookiesArray;
}

// A Token is made of 3 things :
// - Token ID : 32 chars => Used to get the values from the DB
// - Secret Key : 64 chars =>
// - IV : 32 chars
function generateToken() {
    const tokenID = crypto.randomBytes(16);
    const secret = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const tokenIDHex = tokenID.toString("hex");
    const secretHex = secret.toString("hex");
    const ivHex = iv.toString("hex");

    return tokenIDHex + secretHex + ivHex;
}

function throwDatabaseError(err, res) {
    console.log("Database Error !");
    console.log(err.sqlMessage);

    res.status(500);
    res.json({
        "error": "db_error",
        "error_message": "Database error, please contact administrator"
    });

    if (err.isFatal) {
        process.exit(1);
    } else {
        res.end();
    }
}

function decodeToken(token) {
    let tokenID = token.substring(0, 32);
    let secret = token.substring(32, 96);
    let iv = token.substring(96, 128);

    return {
        tokenID: tokenID,
        secret: secret,
        iv: iv
    }
}

function encryptValue(token, value) {
    let tokenData = decodeToken(token);

    return crypto.encrypt(Buffer.from(tokenData.secret, "hex"), Buffer.from(tokenData.iv, "hex"), value);
}

function decryptValue(token, hash) {
    let tokenData = decodeToken(token);

    return crypto.decrypt(Buffer.from(tokenData.secret, "hex"), tokenData.iv, hash);
}

exports.generateAuthToken = async function(query, res, playdateCookieString) {
    let token = generateToken();

    let tokenID = decodeToken(token).tokenID;
    let playdateCookieStringHash = encryptValue(token, playdateCookieString);

    // Inserted content in db are encrypted
    // The only way to decrypt them is to have the token
    // Having the tokenID don't work
    let err, rows = await query("INSERT INTO auth_tokens (token_id, playdate_cookie_string) VALUES (?, ?)", [tokenID, playdateCookieStringHash]);

    if (err) {
        throwDatabaseError(err, res);

        return [true, null];
    }

    return [false, token];
}

exports.checkAuthToken = async function(query, req, res) {
    if (!isSet(req.header("Authentication"))) {
        res.status(401);
        res.json({
            "error": "missing_auth_token",
            "error_message": "Missing Authentication token"
        });
        return res.end();
    }

    const authToken = req.header("Authentication");

    if (authToken.length !== 128) {
        res.status(401);
        res.json({
            "error": "invalid_auth_token",
            "error_message": "Invalid Authentication token"
        });
        return res.end();
    }

    const decodedToken = decodeToken(authToken);

    let err, rows = await query("SELECT * FROM auth_tokens WHERE token_id = ?", [decodedToken.tokenID]);

    if (err) {
        throwDatabaseError(err, res);

        return [true, null];
    } else if (rows.length === 0) {
        res.status(401);
        res.json({
            "error": "invalid_auth_token",
            "error_message": "Invalid Authentication token"
        });

        res.end();

        return [true, null];
    } else {
        return [false, authToken];
    }
}

exports.getCookieString = async function(query, res, token) {
    const decodedToken = decodeToken(token);

    let err, rows = await query("SELECT * FROM auth_tokens WHERE token_id = ?", [decodedToken.tokenID]);

    if (err) {
        throwDatabaseError(err, res);
    } else if (rows.length === 0) {
        res.status(401);
        res.json({
            "error": "auth_token_bypass_error",
            "error_message": "The provided Token is invalid but bypassed verifications, please contact administrator"
        });
        res.end();

        return [true, null];
    } else {
        const cookieStringHash = rows[0].playdate_cookie_string;
        const cookieString = decryptValue(token, cookieStringHash);

        return [false, cookieString];
    }
}

// Exports
exports.isSet = isSet;
exports.parseCookieString = parseCookieString;
exports.decodeToken = decodeToken;