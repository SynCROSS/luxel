import { hydrateFromDocument } from "../runtime/hydrate.ts";
import * as routeIndex from "./routes/index.ts";

hydrateFromDocument({
  "route:index": routeIndex,
});
