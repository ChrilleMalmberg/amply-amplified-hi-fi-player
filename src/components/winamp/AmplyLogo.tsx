import bolt from "@/assets/bolt-icon.svg";

/** Original AmPly logo: bolt + "AmPly" + outlined HI-FI badge (own artwork, no third-party marks). */
export function AmplyLogo({ size = 20 }: { size?: number }) {
  return (
    <span className="amply-logo" style={{ fontSize: size }}>
      <img src={bolt} alt="" aria-hidden width={size * 1.3} height={size * 1.3} />
      <span className="amply-name">Am<b>P</b>ly</span>
      <span className="amply-hifi">HI·FI</span>
    </span>
  );
}
