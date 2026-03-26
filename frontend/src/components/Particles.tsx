export function Particles() {
  return (
    <>
      {/* Floating bubbles */}
      <div className="particles-container">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className="particle" />
        ))}
      </div>
      {/* Star layers */}
      <div className="stars-layer">
        <div className="stars-1" />
        <div className="stars-2" />
      </div>
    </>
  );
}
