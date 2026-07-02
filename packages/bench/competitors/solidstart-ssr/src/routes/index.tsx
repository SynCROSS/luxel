import { createSignal } from "solid-js";

export default function Home() {
  const [count] = createSignal(0);
  return (
    <>
      <h1>Hello Luxel</h1>
      <section><button type="button" data-luxel-text="count">{count()}</button></section>
    </>
  );
}