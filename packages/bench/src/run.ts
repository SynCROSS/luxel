import { runCounterBench } from "@luxel/luxel";

const { throughputRps, clientBytes } = await runCounterBench();
console.log(`counter SSR throughput: ${throughputRps.toFixed(0)} req/s`);
console.log(`counter client JS size: ${clientBytes} bytes`);
