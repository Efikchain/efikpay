const express = require("express");

const {
  getBanks,
    resolveAccount
    } = require("../controllers/bankController");

    const router = express.Router();

    router.get("/", getBanks);

    router.post(
      "/resolve",
        resolveAccount
        );

        module.exports = router;