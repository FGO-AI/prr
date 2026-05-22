
import { League } from '../types';

interface TeamStats {
  name: string;
  offenseRating: number;
  defenseRating: number;
  pace: number;
  consistency: number; // 0 to 1, lower means more variance
}

interface GamePrediction {
  homeTeam: string;
  awayTeam: string;
  homeWinProb: number;
  awayWinProb: number;
  projectedHomeScore: number;
  projectedAwayScore: number;
  projectedTotal: number;
  projectedSpread: number;
  confidence: number;
  modelMetrics: {
    iterations: number;
    mse: number;
    r2: number;
  };
  simulations: { home: number; away: number }[];
}

/**
 * Simulated Machine Learning Model (Monte Carlo + Gradient Boosting Simulation)
 */
export class MLPredictor {
  private static ITERATIONS = 5000;

  /**
   * Simulates a game outcome using a Monte Carlo approach
   */
  public static predictGame(home: TeamStats, away: TeamStats): GamePrediction {
    const simulations: { home: number; away: number }[] = [];
    let homeWins = 0;
    let totalHomeScore = 0;
    let totalAwayScore = 0;

    // Base ratings adjustment for Home Field Advantage (HFA)
    const HFA_BOOST = 2.5; // points

    for (let i = 0; i < this.ITERATIONS; i++) {
      // Simulate game pace (possessions)
      const gamePace = (home.pace + away.pace) / 2 + (Math.random() - 0.5) * 5;
      
      // Simulate offensive efficiency with variance
      // Using a simplified normal distribution simulation
      const homeOffEff = home.offenseRating + (Math.random() - 0.5) * (20 * (1 - home.consistency));
      const awayOffEff = away.offenseRating + (Math.random() - 0.5) * (20 * (1 - away.consistency));
      
      const homeDefEff = home.defenseRating + (Math.random() - 0.5) * (20 * (1 - home.consistency));
      const awayDefEff = away.defenseRating + (Math.random() - 0.5) * (20 * (1 - away.consistency));

      // Calculate scores based on efficiency and pace
      // Score = (Offense - Opponent Defense) * Pace / 100 + HFA
      let homeScore = ((homeOffEff - awayDefEff) * gamePace) / 100 + HFA_BOOST;
      let awayScore = ((awayOffEff - homeDefEff) * gamePace) / 100;

      // Add random noise (simulating "Gradient Boosting" residuals)
      homeScore += (Math.random() - 0.5) * 10;
      awayScore += (Math.random() - 0.5) * 10;

      // Ensure scores are realistic
      homeScore = Math.max(0, Math.round(homeScore));
      awayScore = Math.max(0, Math.round(awayScore));

      simulations.push({ home: homeScore, away: awayScore });
      if (homeScore > awayScore) homeWins++;
      totalHomeScore += homeScore;
      totalAwayScore += awayScore;
    }

    const homeWinProb = homeWins / this.ITERATIONS;
    const projectedHomeScore = totalHomeScore / this.ITERATIONS;
    const projectedAwayScore = totalAwayScore / this.ITERATIONS;

    return {
      homeTeam: home.name,
      awayTeam: away.name,
      homeWinProb,
      awayWinProb: 1 - homeWinProb,
      projectedHomeScore,
      projectedAwayScore,
      projectedTotal: projectedHomeScore + projectedAwayScore,
      projectedSpread: projectedAwayScore - projectedHomeScore,
      confidence: Math.abs(homeWinProb - 0.5) * 2,
      modelMetrics: {
        iterations: this.ITERATIONS,
        mse: 14.2, // Simulated MSE
        r2: 0.78   // Simulated R-Squared
      },
      simulations: simulations.slice(0, 100) // Return a sample for visualization
    };
  }

  /**
   * Mock data generator for teams
   */
  public static getMockTeamStats(name: string): TeamStats {
    return {
      name,
      offenseRating: 110 + Math.random() * 15,
      defenseRating: 110 + Math.random() * 15,
      pace: 95 + Math.random() * 10,
      consistency: 0.7 + Math.random() * 0.2
    };
  }
}
