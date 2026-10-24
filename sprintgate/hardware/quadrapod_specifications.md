# Quadrapod Hardware Stand Mechanical Blueprint

## Base Footprint
- Built from a single 5-way 1/2" PVC elbow connector to form a stable 4-legged quadrapod base.

## Leg Specifications
- Four 40 cm horizontal PVC legs providing an 85 cm tip-to-tip span.
- **Crucial:** Must be filled with dry sand and permanently capped with PVC cement to drastically lower the center of gravity and eliminate wind shudder.

## Vertical Mast
- 95 cm vertical riser pole. 
- Places the optical LDR sensor and laser at exactly 90-100 cm (hip/pelvis height). This perfectly matches the human center of mass to prevent false triggers from swinging arms or legs.
- Removable for transport.

## Enclosure
- Weatherproof IP65 100x100x70mm junction box.
- Bolted directly through the top of the vertical mast so it sits flush.
- Houses the ESP32 and LDR.
- Uses downward-facing cable glands for power/wiring to prevent water ingress.
