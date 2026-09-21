-- Friendly names for RFID cards (who/which car a card belongs to).
-- Kept in its own table so nothing about it leaks into OCPP messages.
-- Idempotent: safe to run on every stack start.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS "CardLabels" (
  "idToken"   citext PRIMARY KEY,
  "name"      text NOT NULL DEFAULT '',
  "car"       text NOT NULL DEFAULT '',
  "notes"     text NOT NULL DEFAULT '',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
