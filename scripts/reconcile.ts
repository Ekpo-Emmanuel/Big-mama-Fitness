import { reconcileReservations } from "../lib/reconcile";

async function main() {
  const result = await reconcileReservations();
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
