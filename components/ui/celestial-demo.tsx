"use client";

import React from "react";
import { CelestialSphere } from "@/components/ui/celestial-sphere";

export default function DemoOne() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-black">
      <CelestialSphere
        hue={210.0}
        speed={0.4}
        zoom={1.2}
        particleSize={4.0}
        className="absolute top-0 left-0 w-full h-full"
      />
      <div className="relative z-10 text-center text-white pointer-events-none">
        <h1 className="text-6xl font-bold tracking-tighter">Celestial Sphere</h1>
        <p className="mt-4 text-lg text-gray-300">An interactive WebGL shader component for React.</p>
      </div>
    </div>
  );
}
