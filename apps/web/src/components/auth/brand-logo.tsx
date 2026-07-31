import Image from "next/image";

// The original Pakistan Sweet Home logo — placed by hand at apps/web/public/psh-logo.png
// (not generated or redrawn here). Intrinsic width/height match the asset's own square
// aspect ratio; actual rendered size is controlled entirely by className so it can scale
// down on mobile without next/image recalculating layout.
export function BrandLogo() {
  return (
    <Image
      src="/psh-logo.png"
      alt="Pakistan Sweet Home"
      width={130}
      height={130}
      priority
      className="h-20 w-20 object-contain sm:h-28 sm:w-28 lg:h-32.5 lg:w-32.5"
    />
  );
}
