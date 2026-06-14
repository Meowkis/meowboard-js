const crypto = require("node:crypto");

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/make-admin-hash.js '<password>'");
  process.exit(1);
}

const salt = crypto.randomBytes(16);

crypto.scrypt(
  password,
  salt,
  64,
  {
    cost: 32768,
    blockSize: 8,
    parallelization: 1,
    maxmem: 128 * 1024 * 1024
  },
  (err, derivedKey) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    console.log(
      `scrypt$32768$8$1$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`
    );
  }
);