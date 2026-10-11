<script setup lang="ts">
import { Bell } from '@lucide/vue';
import { Logo } from '@motopapers/ui';
import PhoneArt from './PhoneArt.vue';

/**
 * The sign-in and sign-up frame from the design: the coral art panel on the left (wide screens
 * only) and the form card on the right. `art` picks the picture: the phone with a reminder
 * (sign in) or the three sign-up steps.
 */
withDefaults(defineProps<{ headline: string; art?: 'phone' | 'steps' }>(), { art: 'phone' });
</script>

<template>
  <div class="auth">
    <aside class="auth-art">
      <Logo />
      <h2>{{ headline }}</h2>
      <div v-if="art === 'phone'" class="art-stage">
        <span class="ghost-plate gp" aria-hidden="true">LSD 482 KJ</span>
        <div class="float" aria-hidden="true">
          <span class="fi"><Bell class="ic" /></span>
          <div>
            <b>Insurance due in 9 days</b>
            <span>KJA 731 AE · Tap to renew now</span>
          </div>
        </div>
        <PhoneArt />
      </div>
      <template v-else>
        <span class="ghost-plate gp" aria-hidden="true">KJA 731 AE</span>
        <ol class="art-steps">
          <li>
            <span class="n" aria-hidden="true">1</span>
            <div><b>Create your account</b><span>Your name, phone number and email.</span></div>
          </li>
          <li>
            <span class="n" aria-hidden="true">2</span>
            <div><b>Verify your email</b><span>Enter the 6-digit code we send you.</span></div>
          </li>
          <li>
            <span class="n" aria-hidden="true">3</span>
            <div>
              <b>Add your first car</b><span>Upload your licence and we fill in the rest.</span>
            </div>
          </li>
        </ol>
      </template>
    </aside>
    <div class="auth-form">
      <div class="auth-card">
        <Logo class="auth-logo" />
        <slot />
      </div>
    </div>
  </div>
</template>

<style>
/* The bare layout centres a card; the auth frame fills the screen instead. */
.bare:has(> .auth) {
  display: block;
  place-items: normal;
  padding: 0;
}

.auth {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  min-height: 100vh;
  min-height: 100dvh;
}
.auth-art {
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  background: var(--coral);
  color: #fff;
  padding: 36px 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.auth-art .logo {
  color: #fff;
}
.auth-art .logo i {
  background: #fff;
  color: var(--coral);
}
.auth-art h2 {
  font-weight: 900;
  font-size: clamp(28px, 3vw, 42px);
  letter-spacing: -0.04em;
  line-height: 1;
  max-width: 14ch;
  position: relative;
  z-index: 1;
}
.auth-art .art-stage {
  position: relative;
  flex: 1;
  min-height: 420px;
}
.auth-art .phone {
  position: absolute;
  left: 50%;
  bottom: -120px;
  transform: translateX(-50%) rotate(-4deg);
  --pw: 260px;
}
.auth-art .float {
  position: absolute;
  z-index: 4;
  top: 30px;
  right: 0;
  width: 270px;
  background: #fff;
  color: var(--ink);
  border-radius: var(--radius-xl);
  padding: 12px 14px;
  box-shadow: var(--shadow);
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  text-align: left;
}
.auth-art .float .fi {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  background: var(--coral-soft);
  color: var(--coral-d);
}
.auth-art .float b {
  display: block;
  font-size: 13.5px;
  font-weight: 800;
}
.auth-art .float span {
  display: block;
  font-size: 12.5px;
  color: var(--muted);
}
.auth-art .ghost-plate {
  position: absolute;
  width: 340px;
  height: 150px;
  border-radius: var(--radius-2xl);
  border: 3px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.08);
  display: grid;
  place-items: center;
  font-family: var(--f-head);
  font-weight: 900;
  font-size: 50px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
}
.auth-art .gp {
  left: -90px;
  top: 200px;
  transform: rotate(18deg);
}
.art-steps {
  display: grid;
  gap: 14px;
  position: relative;
  z-index: 1;
  margin-top: auto;
}
.art-steps li {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  background: rgba(255, 255, 255, 0.14);
  border-radius: var(--radius-xl);
  padding: 12px;
}
.art-steps .n {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--coral-d);
  display: grid;
  place-items: center;
  font-family: var(--f-head);
  font-weight: 900;
  font-size: 20px;
}
.art-steps b {
  display: block;
  font-family: var(--f-head);
  font-size: 17px;
}
.art-steps span {
  font-size: 13.5px;
  opacity: 0.9;
}

.auth-form {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: #fff;
  border-radius: 32px;
}
.auth-card {
  width: 100%;
  max-width: 420px;
  display: grid;
  gap: 18px;
}
.auth-card h1 {
  font-weight: 900;
  font-size: 36px;
  letter-spacing: -0.035em;
}
.auth-card h1:focus {
  outline: none;
}
.auth-card .intro {
  display: grid;
  gap: 6px;
}
.auth-card form {
  display: grid;
  gap: 18px;
}
.auth-card .center {
  text-align: center;
}
.auth-card .or {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}
.auth-card .or::before,
.auth-card .or::after {
  content: '';
  height: 1px;
  background: var(--line);
  flex: 1;
}
.auth-card .link.small {
  font-size: 13px;
}
.auth-card .check {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-2);
  cursor: pointer;
  justify-self: start;
}
.auth-card .check input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--coral-d);
}
.auth-card .mock-note {
  font-size: 12.5px;
  color: var(--muted);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: var(--bg);
  text-align: center;
}
.auth-card .text-button {
  font-size: inherit;
}
.auth-card .text-button:disabled {
  color: var(--muted);
  text-decoration: none;
  cursor: default;
}
.auth-card > .auth-logo {
  display: none;
}

@media (max-width: 960px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
    padding: 8px;
  }
  .auth-art {
    display: none;
  }
  .auth-form {
    border-radius: var(--radius-2xl);
    align-items: flex-start;
    padding: 24px 16px 32px;
  }
  .auth-card > .auth-logo {
    display: inline-flex;
  }
}
@media (max-width: 420px) {
  .auth-card h1 {
    font-size: 30px;
  }
}
</style>
