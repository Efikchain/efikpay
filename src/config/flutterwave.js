const axios = require("axios");

if (!process.env.FLW_SECRET_KEY) {
  throw new Error("FLW_SECRET_KEY is not configured");
  }

  const flutterwave = axios.create({
    baseURL: process.env.FLW_BASE_URL || "https://api.flutterwave.com/v3",
      timeout: 30000,
        headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
                "Content-Type": "application/json"
                  }
                  });

                  module.exports = flutterwave;