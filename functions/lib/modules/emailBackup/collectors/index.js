"use strict";
// ─── Collector Registration ───────────────────────────────────────────────────
//
// This file is the single place where module collectors are registered.
// The backup scheduler imports this file once at startup, populating the
// moduleRegistry with all available collectors.
//
// To add a new module (e.g. bioquímica):
//   1. Create collectors/bioquimicaCollector.ts implementing ModuleCollector
//   2. Import it here and call moduleRegistry.register(bioquimicaCollector)
//   3. Done — the backup system picks it up on next deploy
Object.defineProperty(exports, "__esModule", { value: true });
const registry_1 = require("../registry");
const hematologiaCollector_1 = require("./hematologiaCollector");
const imunoCollector_1 = require("./imunoCollector");
registry_1.moduleRegistry.register(hematologiaCollector_1.hematologiaCollector);
registry_1.moduleRegistry.register(imunoCollector_1.imunoCollector);
// Future modules — uncomment as they are implemented:
// import { bioquimicaCollector } from './bioquimicaCollector';
// moduleRegistry.register(bioquimicaCollector);
//
// import { coagulacaoCollector } from './coagulacaoCollector';
// moduleRegistry.register(coagulacaoCollector);
//
// import { urinaliseCollector } from './urinaliseCollector';
// moduleRegistry.register(urinaliseCollector);
//# sourceMappingURL=index.js.map