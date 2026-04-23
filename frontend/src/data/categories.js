export const categories = [
  {
    id: 1,
    name: 'Lifts',
    subcategories: [
      { id: 1, name: 'Stopped' },
      { id: 2, name: 'Not moving' },
      { id: 3, name: 'Door stuck' },
      { id: 4, name: 'Unusual noise' },
      { id: 5, name: 'Emergency alarm issue' },
      { id: 6, name: 'Lift shaking / jerking' },
      { id: 7, name: 'Other' }
    ]
  },
  {
    id: 2,
    name: 'Drainage',
    subcategories: [
      { id: 1, name: 'Drain blocked' },
      { id: 2, name: 'Slow drainage' },
      { id: 3, name: 'Drain overflow' },
      { id: 4, name: 'Backflow issue' },
      { id: 5, name: 'Rainwater not clearing' },
      { id: 6, name: 'Pipe damage' },
      { id: 7, name: 'Other' }
    ]
  },
  {
    id: 3,
    name: 'Septic Cleaning',
    subcategories: [
      { id: 1, name: 'Septic tank full' },
      { id: 2, name: 'Bad smell' },
      { id: 3, name: 'Overflow' },
      { id: 4, name: 'Blockage' },
      { id: 5, name: 'Slow outflow' },
      { id: 6, name: 'Leakage around tank' },
      { id: 7, name: 'Cleaning required' },
      { id: 8, name: 'Inspection required' },
      { id: 9, name: 'Lid damage' },
      { id: 10, name: 'Emergency service needed' },
      { id: 11, name: 'Other' }
    ]
  },
  {
    id: 4,
    name: 'Generator',
    subcategories: [
      { id: 1, name: 'Not starting' },
      { id: 2, name: 'Low power output' },
      { id: 3, name: 'Fuel leakage' },
      { id: 4, name: 'Battery problem' },
      { id: 5, name: 'Unusual noise' },
      { id: 6, name: 'Smoke issue' },
      { id: 7, name: 'Auto start not working' },
      { id: 8, name: 'Overheating' },
      { id: 9, name: 'Service due' },
      { id: 10, name: 'Electrical trip issue' },
      { id: 11, name: 'Other' }
    ]
  },
  {
    id: 5,
    name: 'Water Tank Cleaning',
    subcategories: [
      { id: 1, name: 'Cleaning required' },
      { id: 2, name: 'Dirty water' },
      { id: 3, name: 'Bad smell' },
      { id: 4, name: 'Algae formation' },
      { id: 5, name: 'Tank leakage' },
      { id: 6, name: 'Inlet problem' },
      { id: 7, name: 'Outlet problem' },
      { id: 8, name: 'Lid damage' },
      { id: 9, name: 'Overflow issue' },
      { id: 10, name: 'Other' }
    ]
  },
  {
    id: 6,
    name: 'AC',
    subcategories: [
      { id: 1, name: 'Not cooling' },
      { id: 2, name: 'Low cooling' },
      { id: 3, name: 'Water leakage' },
      { id: 4, name: 'Not turning on' },
      { id: 5, name: 'Unusual noise' },
      { id: 6, name: 'Bad smell' },
      { id: 7, name: 'Remote not working' },
      { id: 8, name: 'Gas refill needed' },
      { id: 9, name: 'Airflow issue' },
      { id: 10, name: 'Service / maintenance required' },
      { id: 11, name: 'Other' }
    ]
  },
  {
    id: 7,
    name: 'Electrical',
    subcategories: [
      { id: 1, name: 'Power outage' },
      { id: 2, name: 'Switch not working' },
      { id: 3, name: 'Socket not working' },
      { id: 4, name: 'MCB tripping' },
      { id: 5, name: 'Light not working' },
      { id: 6, name: 'Fan not working' },
      { id: 7, name: 'Wiring issue' },
      { id: 8, name: 'Burning smell' },
      { id: 9, name: 'Short circuit issue' },
      { id: 10, name: 'New electrical work needed' },
      { id: 11, name: 'Other' }
    ]
  },
  {
    id: 8,
    name: 'Plumbing',
    subcategories: [
      { id: 1, name: 'Water leakage' },
      { id: 2, name: 'Tap issue' },
      { id: 3, name: 'Pipe burst' },
      { id: 4, name: 'Low water pressure' },
      { id: 5, name: 'Drain blockage' },
      { id: 6, name: 'Flush not working' },
      { id: 7, name: 'Sink problem' },
      { id: 8, name: 'Toilet problem' },
      { id: 9, name: 'Valve issue' },
      { id: 10, name: 'New plumbing work needed' },
      { id: 11, name: 'Other' }
    ]
  },
  {
    id: 9,
    name: 'Appliances',
    applianceTypes: [
      { id: 1, name: 'Refrigerator' },
      { id: 2, name: 'Washing Machine' },
      { id: 3, name: 'Dishwasher' },
      { id: 4, name: 'Microwave / Oven' },
      { id: 5, name: 'Chimney / Exhaust' },
      { id: 6, name: 'TV' },
      { id: 7, name: 'Water Dispenser' },
      { id: 8, name: 'Dryer' }
    ],
    subcategories: [
      { id: 1, name: 'Not working' },
      { id: 2, name: 'Not turning on' },
      { id: 3, name: 'Unusual noise' },
      { id: 4, name: 'Button / control issue' },
      { id: 5, name: 'Installation needed' },
      { id: 6, name: 'Service required' },
      { id: 7, name: 'Other' }
    ]
  },
  {
    id: 10,
    name: 'Building Exterior',
    subcategories: [
      { id: 1, name: 'Other' }
    ]
  },
  {
    id: 11,
    name: 'Locks / Keys',
    subcategories: [
      { id: 1, name: 'Lock not working' },
      { id: 2, name: 'Key lost' },
      { id: 3, name: 'Key broken' },
      { id: 4, name: 'Door jammed' },
      { id: 5, name: 'Lock replacement needed' },
      { id: 6, name: 'Smart lock issue' },
      { id: 7, name: 'Handle issue' },
      { id: 8, name: 'Latch issue' },
      { id: 9, name: 'Emergency lock opening' },
      { id: 10, name: 'Other' }
    ]
  },
  {
    id: 12,
    name: 'Painting',
    subcategories: [
      { id: 1, name: 'Repainting needed' },
      { id: 2, name: 'Paint peeling' },
      { id: 3, name: 'Wall stains' },
      { id: 4, name: 'Color fading' },
      { id: 5, name: 'Crack filling needed' },
      { id: 6, name: 'Exterior painting needed' },
      { id: 7, name: 'Interior painting needed' },
      { id: 8, name: 'Touch-up required' },
      { id: 9, name: 'Ceiling paint issue' },
      { id: 10, name: 'Other' }
    ]
  },
  {
    id: 13,
    name: 'Pest Control',
    subcategories: [
      { id: 1, name: 'Cockroach issue' },
      { id: 2, name: 'Mosquito issue' },
      { id: 3, name: 'Termite issue' },
      { id: 4, name: 'Bed bug issue' },
      { id: 5, name: 'General pest treatment needed' },
      { id: 6, name: 'Repeat treatment needed' },
      { id: 7, name: 'Outdoor pest issue' },
      { id: 8, name: 'Emergency infestation complaint' },
      { id: 9, name: 'Other' }
    ]
  },
  {
    id: 14,
    name: 'Water Purification',
    subcategories: [
      { id: 1, name: 'Purifier not working' },
      { id: 2, name: 'No water output' },
      { id: 3, name: 'Low water flow' },
      { id: 4, name: 'Water taste issue' },
      { id: 5, name: 'Filter replacement needed' },
      { id: 6, name: 'Leakage issue' },
      { id: 7, name: 'Power issue' },
      { id: 8, name: 'Service required' },
      { id: 9, name: 'Installation needed' },
      { id: 10, name: 'Other' }
    ]
  },
  {
    id: 15,
    name: 'Hot Water Geyser',
    subcategories: [
      { id: 1, name: 'Not heating' },
      { id: 2, name: 'Low hot water' },
      { id: 3, name: 'Water leakage' },
      { id: 4, name: 'Not turning on' },
      { id: 5, name: 'Thermostat issue' },
      { id: 6, name: 'Pressure issue' },
      { id: 7, name: 'Unusual noise' },
      { id: 8, name: 'Power issue' },
      { id: 9, name: 'Service required' },
      { id: 10, name: 'Replacement needed' },
      { id: 11, name: 'Other' }
    ]
  }
];

export default categories;
