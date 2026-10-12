<script setup lang="ts">
import {
  Car,
  ChevronLeft,
  Ellipsis,
  Gauge,
  House,
  IdCard,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
} from '@lucide/vue';
import { Plate } from '@motopapers/ui';

/** The phone from the design, showing a car's papers. A picture only: hidden from screen readers. */
</script>

<template>
  <div class="phone" aria-hidden="true">
    <div class="ph-screen">
      <div class="ph-hero">
        <div class="ph-pt">
          <span><ChevronLeft class="ic ic-sm" /></span>
          <span><Ellipsis class="ic ic-sm" /></span>
        </div>
        <Plate plate="KJA 731 AE" variant="white" />
        <h4>Toyota Camry</h4>
        <p>2018 · Silver · 2,494 cc</p>
      </div>
      <div class="ph-body">
        <div class="ph-tile wide d-insurance">
          <span class="k"><ShieldCheck class="ic ic-sm" />Insurance · Third party</span>
          <span class="n">9<small>days left</small></span>
          <span class="s">Expires 20 Oct 2026</span>
          <span class="pill">Renew soon</span>
        </div>
        <div class="ph-tile d-licence">
          <span class="k"><IdCard class="ic ic-sm" />Licence</span>
          <span class="n">154<small>d</small></span>
          <span class="s">14 Mar 2027</span>
        </div>
        <div class="ph-tile d-road">
          <span class="k"><Gauge class="ic ic-sm" />Road</span>
          <span class="n">114<small>d</small></span>
          <span class="s">2 Feb 2027</span>
        </div>
        <span class="btn btn-coral">Renew insurance</span>
      </div>
      <div class="ph-tabs">
        <span><House class="ic ic-sm" />Home</span>
        <span class="on"><Car class="ic ic-sm" />My cars</span>
        <span><Receipt class="ic ic-sm" />Payments</span>
        <span><SlidersHorizontal class="ic ic-sm" />Settings</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone {
  width: var(--pw, 290px);
  height: calc(var(--pw, 290px) * 2);
  border-radius: 44px;
  padding: 9px;
  background: var(--night);
  box-shadow:
    0 30px 60px -30px rgba(30, 27, 51, 0.55),
    0 0 0 1px rgba(30, 27, 51, 0.08);
}
.ph-screen {
  height: 100%;
  border-radius: 36px;
  overflow: hidden;
  background: var(--bg);
  color: var(--ink);
  display: flex;
  flex-direction: column;
  text-align: left;
}
.ph-hero {
  background: var(--coral);
  color: #fff;
  padding: 14px 16px 20px;
  border-radius: 0 0 26px 26px;
  display: grid;
  gap: 5px;
}
.ph-pt {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.ph-pt span {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  display: grid;
  place-items: center;
}
.ph-hero .plate {
  justify-self: start;
}
.ph-hero h4 {
  font-weight: 800;
  font-size: 24px;
  line-height: 1.1;
}
.ph-hero p {
  font-size: 12.5px;
  opacity: 0.9;
}
.ph-body {
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.ph-tile {
  border-radius: 18px;
  padding: 12px;
  display: grid;
  gap: 1px;
  align-content: start;
}
.ph-tile.wide {
  grid-column: 1 / -1;
}
.ph-tile .k {
  font-size: 11.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 5px;
}
.ph-tile .n {
  font-family: var(--f-head);
  font-weight: 900;
  font-size: 30px;
  line-height: 1;
  letter-spacing: -0.03em;
  margin-top: 6px;
}
.ph-tile.wide .n {
  font-size: 40px;
}
.ph-tile .n small {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  margin-left: 3px;
}
.ph-tile .s {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.85;
}
.ph-tile .pill {
  justify-self: start;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: #fff;
  color: var(--due-i);
  margin-top: 6px;
}
.ph-body .btn {
  grid-column: 1 / -1;
  height: 44px;
}
.ph-tabs {
  margin-top: auto;
  display: flex;
  justify-content: space-around;
  padding: 10px 6px 14px;
  background: #fff;
  border-top: 1px solid var(--line);
  color: var(--muted);
}
.ph-tabs span {
  display: grid;
  justify-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 700;
}
.ph-tabs .on {
  color: var(--coral-d);
}
</style>
