require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");

const bankRoutes = require("./routes/bankRoutes");

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",")
          : "*",
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
              allowedHeaders: ["Content-Type", "Authorization"],
              }));

              app.use(express.json({
                limit: "1mb"
                }));

                app.use(express.urlencoded({
                  extended: true,
                    limit: "1mb"
                    }));

                    // Frontend
                    app.use(express.static(path.join(__dirname, "../public")));

                    app.get("/", (req, res) => {
                      res.sendFile(
                          path.join(__dirname, "../public/index.html")
                            );
                            });

                            // Health check
                            app.get("/health", (req, res) => {
                              res.status(200).json({
                                  success: true,
                                      service: "EfikPay API",
                                          status: "online",
                                              timestamp: new Date().toISOString()
                                                });
                                                });

                                                // API
                                                app.use("/api/banks", bankRoutes);

                                                // 404
                                                app.use((req, res) => {
                                                  res.status(404).json({
                                                      success: false,
                                                          message: "Endpoint not found"
                                                            });
                                                            });

                                                            // Error handler
                                                            app.use((err, req, res, next) => {
                                                              console.error(err);

                                                                res.status(500).json({
                                                                    success: false,
                                                                        message: "Internal server error"
                                                                          });
                                                                          });

                                                                          const PORT = process.env.PORT || 3000;

                                                                          app.listen(PORT, "0.0.0.0", () => {
                                                                            console.log(`✅ EfikPay Server running on port ${PORT}`);
                                                                            });