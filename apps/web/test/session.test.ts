import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/stores/session';
import { ADA, tokenExpiringIn } from './helpers';

beforeEach(() => {
  setActivePinia(createPinia());
  sessionStorage.clear();
});

describe('session store (phase 0 stub)', () => {
  it('starts signed out', () => {
    const session = useSessionStore();
    expect(session.isSignedIn).toBe(false);
    expect(session.user).toBeNull();
  });

  it('keeps a session across a reload', () => {
    const token = tokenExpiringIn(600);
    useSessionStore().setSession({ token, user: ADA });

    setActivePinia(createPinia());
    const restored = useSessionStore();
    restored.restore();
    expect(restored.isSignedIn).toBe(true);
    expect(restored.token).toBe(token);
    expect(restored.user?.first_name).toBe('Ada');
  });

  it('does not restore an expired token', () => {
    useSessionStore().setSession({ token: tokenExpiringIn(-1), user: ADA });
    setActivePinia(createPinia());
    const restored = useSessionStore();
    restored.restore();
    expect(restored.isSignedIn).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it('ignores a corrupt saved session', () => {
    sessionStorage.setItem('motopapers:session', '{"token":1}');
    const session = useSessionStore();
    session.restore();
    expect(session.isSignedIn).toBe(false);
  });

  it('signs out', () => {
    const session = useSessionStore();
    session.setSession({ token: tokenExpiringIn(600), user: ADA });
    session.signOut();
    expect(session.isSignedIn).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
});
