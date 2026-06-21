using System.Collections.Concurrent;
using System.Collections.Generic;

namespace backend_dotnetWebApi.Services
{
    public class ImportState
    {
        private readonly object _lock = new object();
        public string Status { get; set; } = "idle"; // idle | running | done | error
        public int Total { get; set; } = 0;
        public int Current { get; set; } = 0;
        private List<string> _log = new List<string>();

        public void Log(string message)
        {
            lock (_lock)
            {
                _log.Add(message);
                if (_log.Count > 200)
                {
                    _log = _log.GetRange(_log.Count - 200, 200);
                }
            }
        }

        public object GetStateSnapshot()
        {
            lock (_lock)
            {
                return new
                {
                    status = Status,
                    total = Total,
                    current = Current,
                    log = new List<string>(_log)
                };
            }
        }

        public void Reset()
        {
            lock (_lock)
            {
                Status = "running";
                Total = 0;
                Current = 0;
                _log.Clear();
            }
        }
    }
}
