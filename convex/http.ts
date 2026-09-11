import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth routes (/api/auth/*)
auth.addHttpRoutes(http);

export default http;
