// app/page.tsx - The Indian Bar Company Premium Redesign

"use client";

import { useEffect, useRef, useState } from "react";

const announcedExperienceCount = 7;

const sections = [
  {
    id: "home",
    label: "Your dream weekend is our weekday",
    title: String(announcedExperienceCount),
    titleCont: "Experiences",
    subtitle:
      "Five signature experiences are live now, with two more luxury experiences arriving soon.",
    image: "/tib.png",
    imagePosition: "center center",
    accent: "#FF6B00",
    href: "#martini",
    index: "00",
    slug: "theindianbar",
  },
  {
    id: "martini",
    label: "House Parties",
    title: "Martini",
    titleCont: ".tib",
    subtitle: "Grinding social spice at your door step.",
    image: "/services/martini.jpeg",
    imagePosition: "center center",
    accent: "#CC1B1B",
    href: process.env.NEXT_PUBLIC_MARTINI_URL ?? "http://localhost:3101",
    index: "01",
    slug: "martini.tib",
  },
  {
    id: "negroni",
    label: "Pool Parties",
    title: "Negroni",
    titleCont: ".tib",
    subtitle: "Grinding social spice to your hot summers.",
    image: "/services/negroni.jpeg",
    imagePosition: "center center",
    accent: "#00BCD4",
    href: process.env.NEXT_PUBLIC_NEGRONI_URL ?? "http://localhost:3102",
    index: "02",
    slug: "negroni.tib",
  },
  {
    id: "cosmo",
    label: "Corporate Parties",
    title: "Cosmo-",
    titleCont: "politan.tib",
    subtitle: "Grinding social spice to your corporate.",
    image: "/services/cosmo.jpeg",
    imagePosition: "center center",
    accent: "#7B4FE8",
    href: process.env.NEXT_PUBLIC_COSMOPOLITAN_URL ?? "http://localhost:3103",
    index: "03",
    slug: "cosmopolitan.tib",
  },
  {
    id: "bloodymary",
    label: "Festivals",
    title: "Bloody",
    titleCont: "Mary.tib",
    subtitle: "Grinding social spice to your public events.",
    image: "/services/bloody-mary.jpeg",
    imagePosition: "center center",
    accent: "#B01212",
    href: process.env.NEXT_PUBLIC_BLOODY_MARY_URL ?? "http://localhost:3104",
    index: "04",
    slug: "bloodymary.tib",
  },
  {
    id: "rocketfuel",
    label: "After Dark",
    title: "Rocket",
    titleCont: "Fuel.tib",
    subtitle: "For the city after midnight.",
    image: "/services/rocket-fuel.jpeg",
    imagePosition: "center center",
    accent: "#FF6B00",
    href: process.env.NEXT_PUBLIC_ROCKET_FUEL_URL ?? "http://localhost:3105",
    index: "05",
    slug: "rocketfuel.tib",
  },
];

export default function HomePage() {
  const [active, setActive] = useState(0);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const liveExperienceCount = sections.length - 1;
  const remainingExperienceCount = Math.max(
    announcedExperienceCount - liveExperienceCount,
    0,
  );

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      const items = document.querySelectorAll("section[data-section]");
      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        if (
          rect.top <= window.innerHeight * 0.45 &&
          rect.bottom >= window.innerHeight * 0.45
        ) {
          setActive(index);
        }
      });
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Custom cursor
  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    let raf: number;

    const moveCursor = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      dot.style.left = `${mouseX}px`;
      dot.style.top = `${mouseY}px`;
    };

    const animateRing = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.left = `${ringX}px`;
      ring.style.top = `${ringY}px`;
      raf = requestAnimationFrame(animateRing);
    };

    window.addEventListener("mousemove", moveCursor);
    raf = requestAnimationFrame(animateRing);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      cancelAnimationFrame(raf);
    };
  }, []);

  const currentAccent = sections[active].accent;

  return (
    <main className="page">
      {/* Custom Cursor */}
      <div ref={dotRef} className="cursor-dot" />
      <div
        ref={ringRef}
        className="cursor-ring"
        style={{ borderColor: `${currentAccent}80` }}
      />

      {/* Background images */}
      <div className="backgroundWrapper">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={`backgroundImage ${active === index ? "active" : ""}`}
            style={{
              backgroundImage: `url(${section.image})`,
              backgroundPosition: section.imagePosition,
            }}
          />
        ))}
      </div>

      <div className="overlay" />
      <div className="grain" />

      {/* Header */}
      <header className="siteHeader">
        <a href="#home" className="siteLogo">
          the<span style={{ color: currentAccent }}>indian</span>bar
        </a>
        <a href="mailto:hello@theindianbar.com" className="headerContact">
          Reserve an experience
        </a>
      </header>

      {/* Side navigation */}
      <nav className="sideNav">
        {sections.map((section, index) => (
          <a key={section.id} href={`#${section.id}`} aria-label={section.label}>
            <span
              className={`navDot ${active === index ? "active" : ""}`}
              style={active === index ? { background: section.accent } : {}}
            />
          </a>
        ))}
      </nav>

      {/* Scroll hint */}
      <div className="scrollHint">
        <span>Scroll</span>
        <div className="scrollHintLine" />
      </div>

      {/* Section index display */}
      <div className="sectionIndex">
        {String(active).padStart(2, "0")} - {String(announcedExperienceCount).padStart(2, "0")}
      </div>

      {/* Active section slug */}
      <div className="sectionNumber">{sections[active].slug}</div>

      {/* Sections */}
      {sections.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          data-section
          className={index % 2 === 0 ? "leftAlign" : "rightAlign"}
        >
          <div
            className={`sectionContent ${
              section.id === "home" ? "sectionContentHome" : ""
            }`.trim()}
          >
            {/* Vertical rule line */}
            <span
              className="sectionLine"
              style={{ backgroundColor: section.accent }}
            />

            {/* Category label */}
            <p className="sectionLabel" style={{ color: section.accent }}>
              {section.label}
            </p>

            {/* Large display title */}
            <div className="titleWrapper">
              <h1>
                {section.title}
                {section.titleCont && (
                  <>
                    <br />
                    <span
                      className="titleDotSuffix"
                      style={{ color: section.accent }}
                    >
                      {section.titleCont}
                    </span>
                  </>
                )}
              </h1>
            </div>

            {/* Subtitle */}
            <p className="sectionSubtitle">{section.subtitle}</p>

            {/* CTA */}
            <a
              href={section.href}
              className="sectionButton"
              style={{ color: section.accent }}
            >
              <span>Tap to book luxury</span>
              <span className="arrow">&rarr;</span>
            </a>
          </div>
        </section>
      ))}

      {remainingExperienceCount > 0 && (
        <section className="comingSoonSection" aria-labelledby="coming-soon-title">
          <div className="comingSoonPanel">
            <p className="comingSoonLabel">Coming Soon</p>
            <h2 id="coming-soon-title" className="comingSoonTitle">
              {remainingExperienceCount === 1
                ? "One more luxury experience is on the way."
                : `${remainingExperienceCount} more luxury experiences are on the way.`}
            </h2>
            <p className="comingSoonCopy">
              The remaining signature services are being carefully curated and
              will be introduced soon, with the same elevated attention to
              detail that defines every The Indian Bar Company experience.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
