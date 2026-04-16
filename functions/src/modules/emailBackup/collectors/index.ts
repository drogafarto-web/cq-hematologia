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

import { moduleRegistry }       from '../registry';
import { hematologiaCollector } from './hematologiaCollector';
import { imunoCollector }       from './imunoCollector';

moduleRegistry.register(hematologiaCollector);
moduleRegistry.register(imunoCollector);

// Future modules — uncomment as they are implemented:
// import { bioquimicaCollector } from './bioquimicaCollector';
// moduleRegistry.register(bioquimicaCollector);
//
// import { coagulacaoCollector } from './coagulacaoCollector';
// moduleRegistry.register(coagulacaoCollector);
//
// import { urinaliseCollector } from './urinaliseCollector';
// moduleRegistry.register(urinaliseCollector);
