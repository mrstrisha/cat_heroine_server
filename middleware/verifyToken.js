
import { createRemoteJWKSet, jwtVerify } from "jose";

const authBaseURL = process.env.AUTH_BASE_URL;

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authBaseURL)
);

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).send({
        message: "Unauthorized: Token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authBaseURL,
      audience: authBaseURL,
    });

    req.user = payload;

    next();
  } catch (error) {
    return res.status(401).send({
      message: "Unauthorized: Invalid token",
    });
  }
};
