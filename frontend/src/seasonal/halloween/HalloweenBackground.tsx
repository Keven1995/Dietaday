export function HalloweenBackground({ ghosts }: { ghosts: boolean }) {
  return <div className="halloween-background" aria-hidden="true">
    <span className="halloween-orb halloween-orb-one" />
    <span className="halloween-orb halloween-orb-two" />
    <span className="halloween-web halloween-web-left">✳</span>
    <span className="halloween-web halloween-web-right">✳</span>
    {ghosts && <span className="halloween-ghost">👻</span>}
  </div>
}
