"use client";

import { useState } from "react";

const FILM_SRC = "/media/sahayak-film.mp4";
const FILM_POSTER = "/media/sahayak-film-poster.jpg";

// The film is produced separately into public/media/. If it is missing or
// fails to load, show a quiet placeholder instead of a broken player.
export const HeroVideo = () => {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-t-[999px] rounded-b-3xl border-4 border-[#1B2A5B] bg-[#FFF4D6] shadow-[10px_10px_0_0_#F28C1B]">
      {failed ? (
        <div
          role="img"
          aria-label="Sahayak film is not available yet"
          className="flex aspect-[3/4] flex-col items-center justify-center gap-3 px-8 text-center"
        >
          <span lang="hi" className="font-display text-7xl text-[#1B2A5B]">
            सहायक
          </span>
          <span className="text-sm text-[#1B2A5B]/70">The Sahayak film will appear here.</span>
        </div>
      ) : (
        <video
          className="aspect-[3/4] w-full object-cover"
          controls
          playsInline
          preload="metadata"
          poster={FILM_POSTER}
          onError={() => setFailed(true)}
          src={FILM_SRC}
        >
          Your browser cannot play this video.
        </video>
      )}
    </div>
  );
};
