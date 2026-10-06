export const halloweenConfig = {
  enabled: true,
  normalPeriod: {
    start: '10-01',
    end: '10-24',
  },
  intensePeriod: {
    start: '10-25',
    end: '11-02',
  },
  effects: {
    ghosts: true,
    bats: true,
    eyes: true,
    celebration: true,
    ranking: true,
  },
} as const
