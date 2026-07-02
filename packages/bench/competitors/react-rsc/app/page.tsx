import { CounterButton } from "./CounterButton";
export const dynamic = "force-static";
export default function Page() {
  return (
    <>
      <h1>Hello Luxel</h1>
      <section>
        <CounterButton />
      </section>
    </>
  );
}