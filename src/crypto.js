const crypto = require("crypto");

const algorithm = "aes-256-ctr";

exports.encrypt = function(secret, iv, str) {
    const cipher = crypto.createCipheriv(algorithm, secret, iv);
    const encrypted = Buffer.concat([cipher.update(str), cipher.final()]);

    return encrypted.toString("hex");
}

exports.decrypt = function(secret, iv, data) {
    const decipher = crypto.createDecipheriv(algorithm, secret, Buffer.from(iv, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]);

    return decrypted.toString();
}

exports.randomBytes = crypto.randomBytes;