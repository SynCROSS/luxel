"use client";
import { useState } from "react";

export function CounterApp() {
  const [count] = useState(0);
  return (
    <>
      <h1>Hello Luxel</h1>
      <section>
        <button type="button" data-luxel-text="count">
          {count}
        </button>
      </section>
    </>
  );
}
