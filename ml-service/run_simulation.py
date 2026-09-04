import json
import sys
from app.evaluation.simulator import OfflineBanditSimulator

def main():
    num_samples = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
    simulator = OfflineBanditSimulator(seed=42)
    results = simulator.run_simulation(num_samples=num_samples)
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
