<script setup>
import { ref } from "vue";
const count = ref(0);
</script>

<template>
  <h1>Hello Luxel</h1>
  <section>
    <button type="button" data-luxel-text="count">{{ count }}</button>
  </section>
</template>
