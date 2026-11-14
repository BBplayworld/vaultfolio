import { execSync } from "node:child_process"; import { createRequire } from "node:module"; import path from "node:path";
const g = execSync("npm root -g",{encoding:"utf8"}).trim();
export const { chromium } = createRequire(path.join(g,"noop.js"))("playwright");
export const PV = "https://secretasset-git-issue-5114-bbplayworlds-projects.vercel.app";
export const PROD = "https://www.secretasset.xyz";
export const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
export const ctxOpt = (W, scheme = "dark") => ({ viewport: { width: W, height: W < 700 ? 844 : W < 1100 ? 1024 : 900 }, deviceScaleFactor: 1, colorScheme: scheme, isMobile: W < 700, hasTouch: W < 1100 });
