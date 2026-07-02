"use client";
import { useState } from "react";

export function CounterButton() {
  const [count] = useState(0);
  return (
    <button type="button" data-luxel-text="count">
      {count}
    </button>
  );
}