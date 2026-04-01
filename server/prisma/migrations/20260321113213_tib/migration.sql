DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Lead'
      AND column_name = 'addOns'
  ) THEN
    EXECUTE 'ALTER TABLE "Lead" ALTER COLUMN "addOns" DROP DEFAULT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OtpChallenge'
      AND column_name = 'phone'
  ) THEN
    EXECUTE 'ALTER TABLE "OtpChallenge" ALTER COLUMN "phone" DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'OtpChallenge'
      AND column_name = 'channel'
  ) THEN
    EXECUTE 'ALTER TABLE "OtpChallenge" ALTER COLUMN "channel" DROP DEFAULT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProjectTask'
      AND column_name = 'dependencyIds'
  ) THEN
    EXECUTE 'ALTER TABLE "ProjectTask" ALTER COLUMN "dependencyIds" DROP DEFAULT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProjectTask'
      AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "ProjectTask" ALTER COLUMN "updatedAt" DROP DEFAULT';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProjectTaskComment'
      AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE "ProjectTaskComment" ALTER COLUMN "updatedAt" DROP DEFAULT';
  END IF;
END $$;
