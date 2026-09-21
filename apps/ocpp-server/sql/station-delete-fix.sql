-- Lets a charging station be deleted while it still has history.
--
-- The history tables (Connectors, Transactions, MeterValues, ...) reference
-- ChargingStations with ON DELETE SET NULL, so deleting a station updates those
-- rows (stationId, and via the cascade to Evses also evseId) to NULL. The
-- populate_station_id() trigger runs on those updates, can no longer find the
-- (just deleted) station and raises, which aborts the delete. Only an INSERT for
-- an unknown station is a real error; an UPDATE is let through, and the row keeps
-- its ocppConnectionName so the history stays readable (and re-links if a station
-- with that name is created again).
-- Idempotent: safe to run on every stack start.
CREATE OR REPLACE FUNCTION populate_station_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT "id" INTO NEW."stationId"
  FROM "ChargingStations"
  WHERE "ocppConnectionName" = NEW."ocppConnectionName" AND "tenantId" = NEW."tenantId";

  IF NEW."stationId" IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No ChargingStation found with ocppConnectionName=% and tenantId=%',
                   NEW."ocppConnectionName", NEW."tenantId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
