const crypto = require("crypto")
const path = require("path")
const dotenv = require("dotenv")
const { PrismaClient } = require("@prisma/client")

dotenv.config({ path: path.resolve(__dirname, "../.env") })

const prisma = new PrismaClient()

const TEAM_IMAGE_FOLDER = "tib/team"
const COMPANY_INSTAGRAM = "https://www.instagram.com/theindianbarcompany/"
const COMPANY_LINKEDIN = "https://www.linkedin.com/company/theindianbarcompany/"
const COMPANY_WEBSITE = "https://theindianbarcompany.com"

const sampleMembers = [
  {
    name: "Aanya Kapoor",
    designation: "Founder & Creative Director",
    category: "CORE",
    sortOrder: 0,
    bio: "Builds the signature guest experience, brand voice, and event storytelling behind The Indian Bar.",
    instagramUrl: COMPANY_INSTAGRAM,
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "aanya.kapoor@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/68.jpg",
    imageSlug: "aanya-kapoor",
  },
  {
    name: "Raghav Menon",
    designation: "Head of Experiences",
    category: "CORE",
    sortOrder: 1,
    bio: "Owns premium event operations, guest flow, and service choreography across weddings, launches, and private celebrations.",
    instagramUrl: COMPANY_INSTAGRAM,
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "raghav.menon@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    imageSlug: "raghav-menon",
  },
  {
    name: "Sana Sheikh",
    designation: "Beverage Program Lead",
    category: "CORE",
    sortOrder: 2,
    bio: "Designs menus, tasting flights, and high-energy signature cocktail programs tailored to each event mood.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "sana.sheikh@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/44.jpg",
    imageSlug: "sana-sheikh",
  },
  {
    name: "Arjun Bhasin",
    designation: "Event Operations Lead",
    category: "CORE",
    sortOrder: 3,
    bio: "Coordinates venue execution, bar layouts, and on-ground service timing for large-format celebrations.",
    instagramUrl: COMPANY_INSTAGRAM,
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "arjun.bhasin@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/12.jpg",
    imageSlug: "arjun-bhasin",
  },
  {
    name: "Meera Nair",
    designation: "Client Experience Manager",
    category: "CORE",
    sortOrder: 4,
    bio: "Shapes planning touchpoints, guest-facing details, and communication rhythms from brief to event day.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "meera.nair@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/15.jpg",
    imageSlug: "meera-nair",
  },
  {
    name: "Karan Oberoi",
    designation: "Bar Program Manager",
    category: "CORE",
    sortOrder: 5,
    bio: "Leads inventory planning, service readiness, and premium beverage logistics for high-volume events.",
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "karan.oberoi@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/22.jpg",
    imageSlug: "karan-oberoi",
  },
  {
    name: "Priya Dsouza",
    designation: "Brand Partnerships Lead",
    category: "CORE",
    sortOrder: 6,
    bio: "Develops collaborations, sponsor integrations, and hospitality-driven brand moments that feel editorial and polished.",
    instagramUrl: COMPANY_INSTAGRAM,
    linkedInUrl: COMPANY_LINKEDIN,
    email: "priya.dsouza@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/24.jpg",
    imageSlug: "priya-dsouza",
  },
  {
    name: "Dev Khanna",
    designation: "Production Coordinator",
    category: "CORE",
    sortOrder: 7,
    bio: "Keeps timelines, setup handoffs, and partner coordination tight so every service moment lands smoothly.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "dev.khanna@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/27.jpg",
    imageSlug: "dev-khanna",
  },
  {
    name: "Ishita Verma",
    designation: "Experience Designer",
    category: "CORE",
    sortOrder: 8,
    bio: "Works on menu naming, visual styling, and guest touchpoints that make the bar presence feel intentional and premium.",
    instagramUrl: COMPANY_INSTAGRAM,
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "ishita.verma@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/30.jpg",
    imageSlug: "ishita-verma",
  },
  {
    name: "Neel Joshi",
    designation: "Service Training Lead",
    category: "CORE",
    sortOrder: 9,
    bio: "Builds service standards, bartender readiness, and event playbooks for consistent execution across formats.",
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "neel.joshi@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/47.jpg",
    imageSlug: "neel-joshi",
  },
  {
    name: "Vikram Sethi",
    designation: "Strategic Trustee",
    category: "TRUSTEE",
    sortOrder: 0,
    bio: "Advises on partnerships, hospitality positioning, and long-term growth for flagship brand experiences.",
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "vikram.sethi@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/75.jpg",
    imageSlug: "vikram-sethi",
  },
  {
    name: "Niharika Rao",
    designation: "Brand Trustee",
    category: "TRUSTEE",
    sortOrder: 1,
    bio: "Supports brand partnerships, presentation standards, and premium client-facing communications.",
    instagramUrl: COMPANY_INSTAGRAM,
    linkedInUrl: COMPANY_LINKEDIN,
    email: "niharika.rao@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/65.jpg",
    imageSlug: "niharika-rao",
  },
  {
    name: "Aditya Malhotra",
    designation: "Growth Trustee",
    category: "TRUSTEE",
    sortOrder: 2,
    bio: "Guides market expansion, strategic planning, and long-range investment priorities for the hospitality brand.",
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "aditya.malhotra@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/52.jpg",
    imageSlug: "aditya-malhotra",
  },
  {
    name: "Ritu Anand",
    designation: "Experience Trustee",
    category: "TRUSTEE",
    sortOrder: 3,
    bio: "Brings a guest-first lens to premium service design, event etiquette, and hospitality presentation standards.",
    instagramUrl: COMPANY_INSTAGRAM,
    linkedInUrl: COMPANY_LINKEDIN,
    email: "ritu.anand@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/52.jpg",
    imageSlug: "ritu-anand",
  },
  {
    name: "Farhan Qureshi",
    designation: "Finance Trustee",
    category: "TRUSTEE",
    sortOrder: 4,
    bio: "Advises on unit economics, profitability guardrails, and operational scale decisions across event categories.",
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "farhan.qureshi@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/58.jpg",
    imageSlug: "farhan-qureshi",
  },
  {
    name: "Sonal Bedi",
    designation: "Brand Governance Trustee",
    category: "TRUSTEE",
    sortOrder: 5,
    bio: "Keeps the public brand consistent across partnerships, visuals, and premium audience-facing experiences.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "sonal.bedi@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/58.jpg",
    imageSlug: "sonal-bedi",
  },
  {
    name: "Harsh Vardhan",
    designation: "Operations Trustee",
    category: "TRUSTEE",
    sortOrder: 6,
    bio: "Supports systems thinking, process maturity, and scalable operating rhythms for the wider delivery team.",
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "harsh.vardhan@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/61.jpg",
    imageSlug: "harsh-vardhan",
  },
  {
    name: "Kritika Sen",
    designation: "Communications Trustee",
    category: "TRUSTEE",
    sortOrder: 7,
    bio: "Shapes narrative clarity, trust signals, and tone consistency across brand communications and partner messaging.",
    instagramUrl: COMPANY_INSTAGRAM,
    linkedInUrl: COMPANY_LINKEDIN,
    email: "kritika.sen@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/61.jpg",
    imageSlug: "kritika-sen",
  },
  {
    name: "Rahul Mehta",
    designation: "Strategy Trustee",
    category: "TRUSTEE",
    sortOrder: 8,
    bio: "Works with the leadership team on category positioning, service packaging, and long-term growth bets.",
    linkedInUrl: COMPANY_LINKEDIN,
    websiteUrl: COMPANY_WEBSITE,
    email: "rahul.mehta@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/66.jpg",
    imageSlug: "rahul-mehta",
  },
  {
    name: "Pallavi Iyer",
    designation: "Culture Trustee",
    category: "TRUSTEE",
    sortOrder: 9,
    bio: "Champions team culture, people experience, and the polished service mindset behind every public-facing event.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "pallavi.iyer@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/66.jpg",
    imageSlug: "pallavi-iyer",
  },
  {
    name: "Kabir Arora",
    designation: "Events Storyteller",
    category: "INFLUENCERS",
    sortOrder: 0,
    bio: "Creates social-first content around cocktail culture, event atmosphere, and behind-the-scenes hospitality moments.",
    instagramUrl: COMPANY_INSTAGRAM,
    email: "kabir.arora@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/41.jpg",
    imageSlug: "kabir-arora",
  },
  {
    name: "Tara Malhotra",
    designation: "Lifestyle Creator Partner",
    category: "INFLUENCERS",
    sortOrder: 1,
    bio: "Partners on creator campaigns and helps shape the aspirational visual language of the public-facing team brand.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "tara.malhotra@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/22.jpg",
    imageSlug: "tara-malhotra",
  },
  {
    name: "Aarav Sinha",
    designation: "Cocktail Culture Creator",
    category: "INFLUENCERS",
    sortOrder: 2,
    bio: "Creates punchy short-form content around bar craft, signature serves, and premium celebration moments.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "aarav.sinha@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/43.jpg",
    imageSlug: "aarav-sinha",
  },
  {
    name: "Maya Fernandes",
    designation: "Hospitality Creator Partner",
    category: "INFLUENCERS",
    sortOrder: 3,
    bio: "Spotlights event styling, service rituals, and the elevated visual side of cocktail-led celebrations.",
    instagramUrl: COMPANY_INSTAGRAM,
    email: "maya.fernandes@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/43.jpg",
    imageSlug: "maya-fernandes",
  },
  {
    name: "Rhea Chawla",
    designation: "Lifestyle Story Partner",
    category: "INFLUENCERS",
    sortOrder: 4,
    bio: "Helps translate live events into polished stories that feel editorial, modern, and highly shareable.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "rhea.chawla@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/48.jpg",
    imageSlug: "rhea-chawla",
  },
  {
    name: "Dhruv Bhatia",
    designation: "Nightlife Content Partner",
    category: "INFLUENCERS",
    sortOrder: 5,
    bio: "Creates event-night coverage with an emphasis on mood, music, crowd energy, and hero bar moments.",
    instagramUrl: COMPANY_INSTAGRAM,
    email: "dhruv.bhatia@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/48.jpg",
    imageSlug: "dhruv-bhatia",
  },
  {
    name: "Simran Kaur",
    designation: "Celebration Creator",
    category: "INFLUENCERS",
    sortOrder: 6,
    bio: "Focuses on wedding and private-party storytelling with a premium lens on service details and guest delight.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "simran.kaur@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/53.jpg",
    imageSlug: "simran-kaur",
  },
  {
    name: "Yash Tandon",
    designation: "Events Reels Partner",
    category: "INFLUENCERS",
    sortOrder: 7,
    bio: "Produces high-energy recap content built around pours, crowd reactions, and signature setup moments.",
    instagramUrl: COMPANY_INSTAGRAM,
    email: "yash.tandon@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/53.jpg",
    imageSlug: "yash-tandon",
  },
  {
    name: "Anika Bose",
    designation: "Style and Taste Creator",
    category: "INFLUENCERS",
    sortOrder: 8,
    bio: "Blends fashion, hosting, and cocktail culture into lifestyle-first content for premium urban audiences.",
    instagramUrl: COMPANY_INSTAGRAM,
    websiteUrl: COMPANY_WEBSITE,
    email: "anika.bose@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/women/59.jpg",
    imageSlug: "anika-bose",
  },
  {
    name: "Reyansh Gupta",
    designation: "Premium Events Creator",
    category: "INFLUENCERS",
    sortOrder: 9,
    bio: "Captures the polished side of experiential events with a focus on hospitality, ambience, and memorable service.",
    instagramUrl: COMPANY_INSTAGRAM,
    email: "reyansh.gupta@example.com",
    sourceImageUrl: "https://randomuser.me/api/portraits/men/59.jpg",
    imageSlug: "reyansh-gupta",
  },
]

function getRequiredEnv(key) {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function createCloudinarySignature(params, apiSecret) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")

  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex")
}

async function uploadPortrait(member, cloudName, apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000)
  const publicId = `seed-${member.imageSlug}`
  const params = {
    folder: TEAM_IMAGE_FOLDER,
    overwrite: "true",
    public_id: publicId,
    timestamp,
  }

  const signature = createCloudinarySignature(params, apiSecret)
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    api_key: apiKey,
    file: member.sourceImageUrl,
    signature,
  })

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Cloudinary upload failed for ${member.name}: ${response.status} ${text}`)
  }

  const data = await response.json()

  return {
    photoPublicId: data.public_id,
    photoUrl: data.secure_url,
  }
}

async function upsertTeamMember(member, photo) {
  const existing = await prisma.teamMember.findFirst({
    where: {
      name: member.name,
      deletedAt: null,
    },
  })

  const payload = {
    name: member.name,
    designation: member.designation,
    category: member.category,
    bio: member.bio,
    photoUrl: photo.photoUrl,
    photoPublicId: photo.photoPublicId,
    instagramUrl: member.instagramUrl ?? null,
    linkedInUrl: member.linkedInUrl ?? null,
    websiteUrl: member.websiteUrl ?? null,
    email: member.email ?? null,
    isActive: true,
    isVisible: true,
    sortOrder: member.sortOrder,
    deletedAt: null,
  }

  if (existing) {
    await prisma.teamMember.update({
      where: { id: existing.id },
      data: payload,
    })

    return "updated"
  }

  await prisma.teamMember.create({
    data: payload,
  })

  return "created"
}

async function main() {
  const cloudName = getRequiredEnv("CLOUDINARY_CLOUD_NAME")
  const apiKey = getRequiredEnv("CLOUDINARY_API_KEY")
  const apiSecret = getRequiredEnv("CLOUDINARY_API_SECRET")

  let created = 0
  let updated = 0

  for (const member of sampleMembers) {
    const photo = await uploadPortrait(member, cloudName, apiKey, apiSecret)
    const result = await upsertTeamMember(member, photo)

    if (result === "created") {
      created += 1
    } else {
      updated += 1
    }

    console.log(`${result.toUpperCase()}: ${member.name}`)
  }

  console.log(`Seed complete. Created ${created}, updated ${updated}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
