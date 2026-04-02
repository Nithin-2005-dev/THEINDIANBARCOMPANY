import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

const envFileNames = [".env", ".env.local"];

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

for (const envFileName of envFileNames) {
  loadEnvFile(envFileName);
}

const uri = process.env.MONGODB_URI?.trim();
const dbName = process.env.MONGODB_DB?.trim() || "theindianbar";
const collectionName = process.env.MONGODB_TEAM_COLLECTION?.trim() || "teamMembers";

if (!uri) {
  throw new Error("Missing MONGODB_URI. Set it before running npm run seed:team.");
}

const sampleTeamMembers = [
  {
    id: "core-nikhil-arora",
    name: "Nikhil Arora",
    designation: "Founder and Experience Director",
    category: "CORE",
    bio: "Shapes the guest experience, premium service standards, and delivery quality across each signature event format.",
    instagramUrl: "https://instagram.com/theindianbarcompany",
    websiteUrl: "https://theindianbarcompany.com",
    isActive: true,
    isVisible: true,
    sortOrder: 1,
  },
  {
    id: "core-riya-kapoor",
    name: "Riya Kapoor",
    designation: "Operations and Hospitality Lead",
    category: "CORE",
    bio: "Leads planning systems, staffing readiness, and execution detail so each event feels precise and elevated.",
    linkedInUrl: "https://linkedin.com",
    isActive: true,
    isVisible: true,
    sortOrder: 2,
  },
  {
    id: "trustee-aarav-mehta",
    name: "Aarav Mehta",
    designation: "Strategic Trustee",
    category: "TRUSTEE",
    bio: "Supports long-horizon brand decisions, operating discipline, and partnership strategy.",
    linkedInUrl: "https://linkedin.com",
    isActive: true,
    isVisible: true,
    sortOrder: 1,
  },
  {
    id: "trustee-sana-iyer",
    name: "Sana Iyer",
    designation: "Brand and Growth Trustee",
    category: "TRUSTEE",
    bio: "Advises on positioning, audience strategy, and brand credibility across premium hospitality channels.",
    linkedInUrl: "https://linkedin.com",
    isActive: true,
    isVisible: true,
    sortOrder: 2,
  },
  {
    id: "influencer-zoya-shah",
    name: "Zoya Shah",
    designation: "Influencer Partner",
    category: "INFLUENCERS",
    bio: "Collaborates on culture-led storytelling and public-facing brand moments.",
    instagramUrl: "https://instagram.com",
    isActive: true,
    isVisible: true,
    sortOrder: 1,
  },
  {
    id: "influencer-rahul-verma",
    name: "Rahul Verma",
    designation: "Influencer Partner",
    category: "INFLUENCERS",
    bio: "Extends the brand into creator communities through hospitality-first campaigns and launches.",
    instagramUrl: "https://instagram.com",
    isActive: true,
    isVisible: true,
    sortOrder: 2,
  },
];

const client = new MongoClient(uri);

try {
  await client.connect();

  const collection = client.db(dbName).collection(collectionName);

  for (const member of sampleTeamMembers) {
    await collection.updateOne(
      { id: member.id },
      {
        $set: {
          ...member,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  }

  console.log(
    `Seeded ${sampleTeamMembers.length} team members into ${dbName}.${collectionName}.`,
  );
} finally {
  await client.close();
}
