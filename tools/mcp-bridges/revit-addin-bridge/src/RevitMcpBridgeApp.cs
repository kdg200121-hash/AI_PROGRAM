using System;
using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Text;
using System.Threading;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace RevitMcpBridge
{
    public class RevitMcpBridgeApp : IExternalApplication
    {
        private BridgeHttpServer _server;
        private RevitRequestHandler _handler;
        private ExternalEvent _externalEvent;
        private static string _startupStatus = "Revit MCP bridge has not started yet.";

        public Result OnStartup(UIControlledApplication application)
        {
            _handler = new RevitRequestHandler();
            _externalEvent = ExternalEvent.Create(_handler);
            try
            {
                _server = new BridgeHttpServer("http://127.0.0.1:5101/", _handler, _externalEvent);
                _server.Start();
                _startupStatus = "Revit MCP bridge is running.\n\nEndpoint: http://127.0.0.1:5101/active-file";
            }
            catch (Exception ex)
            {
                _startupStatus = "Revit MCP bridge could not open port 5101.\n\n" +
                    "Close other Revit windows using AI Program MCP, then restart Revit.\n\n" +
                    "Details: " + ex.Message;
                if (_server != null)
                {
                    _server.Dispose();
                    _server = null;
                }
            }
            AddRibbonButton(application);
            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            if (_server != null)
            {
                _server.Dispose();
            }
            return Result.Succeeded;
        }

        private static void AddRibbonButton(UIControlledApplication application)
        {
            try
            {
                var panel = GetOrCreateRibbonPanel(application);
                var buttonData = new PushButtonData(
                    "AIProgramMcpBridgeStatus",
                    "AI Program\nMCP",
                    typeof(RevitMcpBridgeApp).Assembly.Location,
                    typeof(ShowBridgeStatusCommand).FullName);

                buttonData.ToolTip = "AI Program Revit MCP 연결 상태와 활성 파일 endpoint를 확인합니다.";
                panel.AddItem(buttonData);
            }
            catch
            {
                // The HTTP bridge can still run even if the ribbon button cannot be added.
            }
        }

        private static RibbonPanel GetOrCreateRibbonPanel(UIControlledApplication application)
        {
            foreach (var panel in application.GetRibbonPanels())
            {
                if (panel.Name == "AI Program")
                {
                    return panel;
                }
            }

            return application.CreateRibbonPanel("AI Program");
        }
    }

    [Transaction(TransactionMode.Manual)]
    public class ShowBridgeStatusCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            TaskDialog.Show(
                "AI Program MCP",
                "Revit MCP bridge is running.\n\nEndpoint: http://127.0.0.1:5101/active-file");

            return Result.Succeeded;
        }
    }

    internal sealed class BridgeHttpServer : IDisposable
    {
        private readonly HttpListener _listener;
        private readonly RevitRequestHandler _handler;
        private readonly ExternalEvent _externalEvent;
        private readonly Thread _thread;
        private volatile bool _running;
        private const int RevitRequestTimeoutSeconds = 12;
        private const string RevitBusySuggestion = "Press ESC in Revit, finish or cancel the current Revit command, then run again.";

        public BridgeHttpServer(string prefix, RevitRequestHandler handler, ExternalEvent externalEvent)
        {
            _handler = handler;
            _externalEvent = externalEvent;
            _listener = new HttpListener();
            _listener.Prefixes.Add(prefix);
            _thread = new Thread(ListenLoop) { IsBackground = true, Name = "AI Program Revit MCP Bridge" };
        }

        public void Start()
        {
            _running = true;
            _listener.Start();
            _thread.Start();
        }

        private void ListenLoop()
        {
            while (_running)
            {
                try
                {
                    var context = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(_ => Handle(context));
                }
                catch
                {
                    if (_running)
                    {
                        Thread.Sleep(50);
                    }
                }
            }
        }

        private void Handle(HttpListenerContext context)
        {
            var path = context.Request.Url == null ? "/" : context.Request.Url.AbsolutePath.ToLowerInvariant();
            if (path == "/commands" || path == "/mcp/commands")
            {
                WriteJson(context.Response, CommandsJson());
                return;
            }

            if (path == "/active-file" || path == "/mcp/active-file" || path == "/current-file" || path == "/status" || path == "/mcp/status")
            {
                WriteJson(context.Response, GetActiveFileJson(path.Contains("status")));
                return;
            }

            var command = CommandFromRequest(context, path);
            if (command == "revit.get_active_document" || command == "active-file")
            {
                WriteJson(context.Response, GetActiveFileJson(false));
                return;
            }
            if (command == "revit.list_levels")
            {
                WriteJson(context.Response, GetRevitCommandJson(command));
                return;
            }

            WriteJson(context.Response, "{\"ok\":true,\"program\":\"Revit\",\"target\":\"revit\",\"endpoints\":[\"/status\",\"/active-file\",\"/commands\",\"/mcp\",\"/tools/revit.list_levels\"],\"commands\":[\"revit.get_active_document\",\"revit.list_levels\"],\"message\":\"AI Program Revit MCP add-in bridge is running.\"}");
        }

        private string GetActiveFileJson(bool statusOnly)
        {
            var request = new BridgeRequest { Command = "active-file" };
            _handler.Enqueue(request);
            _externalEvent.Raise();

            if (!request.Done.Wait(TimeSpan.FromSeconds(RevitRequestTimeoutSeconds)))
            {
                return RevitBusyJson("active-file", "Timed out while reading Revit ActiveUIDocument.");
            }

            if (statusOnly && request.Ok)
            {
                return "{\"ok\":true,\"program\":\"Revit\",\"target\":\"revit\",\"connectedToProgram\":true,\"activeFile\":\"" + EscapeJson(request.FullName) + "\"}";
            }

            return request.Json;
        }

        private string GetRevitCommandJson(string command)
        {
            var request = new BridgeRequest { Command = command };
            _handler.Enqueue(request);
            _externalEvent.Raise();

            if (!request.Done.Wait(TimeSpan.FromSeconds(RevitRequestTimeoutSeconds)))
            {
                return RevitBusyJson(command, "Timed out while reading Revit model data.");
            }

            return request.Json;
        }

        private static string RevitBusyJson(string command, string detail)
        {
            return "{\"ok\":false,\"program\":\"Revit\",\"target\":\"revit\",\"connectedToProgram\":true," +
                "\"command\":\"" + EscapeJson(command) + "\"," +
                "\"code\":\"revitBusyOrBlocked\"," +
                "\"retryable\":true," +
                "\"message\":\"" + EscapeJson(detail + " " + RevitBusySuggestion) + "\"," +
                "\"suggestion\":\"" + EscapeJson(RevitBusySuggestion) + "\"}";
        }

        private static string CommandsJson()
        {
            return "{\"ok\":true,\"program\":\"Revit\",\"target\":\"revit\",\"commands\":[{\"name\":\"revit.get_active_document\",\"description\":\"Read the current active Revit document path.\"},{\"name\":\"revit.list_levels\",\"description\":\"Read level names and elevations from the active Revit document.\"}]}";
        }

        private static string CommandFromRequest(HttpListenerContext context, string path)
        {
            if (path.StartsWith("/tools/"))
            {
                return Uri.UnescapeDataString(path.Substring("/tools/".Length));
            }
            if (path.StartsWith("/mcp/tools/"))
            {
                return Uri.UnescapeDataString(path.Substring("/mcp/tools/".Length));
            }

            if (context.Request.HttpMethod == "POST" && (path == "/mcp" || path == "/"))
            {
                var body = ReadRequestBody(context.Request);
                if (body.Contains("tools/call") && body.Contains("revit.list_levels"))
                {
                    return "revit.list_levels";
                }
                if (body.Contains("tools/call") && body.Contains("revit.get_active_document"))
                {
                    return "revit.get_active_document";
                }
            }

            return string.Empty;
        }

        private static string ReadRequestBody(HttpListenerRequest request)
        {
            if (!request.HasEntityBody)
            {
                return string.Empty;
            }

            using (var reader = new System.IO.StreamReader(request.InputStream, request.ContentEncoding ?? Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        private static void WriteJson(HttpListenerResponse response, string json)
        {
            var bytes = Encoding.UTF8.GetBytes(json);
            response.ContentType = "application/json; charset=utf-8";
            response.ContentLength64 = bytes.Length;
            response.AddHeader("Access-Control-Allow-Origin", "*");
            response.OutputStream.Write(bytes, 0, bytes.Length);
            response.OutputStream.Close();
        }

        public static string EscapeJson(string value)
        {
            return (value ?? string.Empty)
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");
        }

        public void Dispose()
        {
            _running = false;
            if (_listener.IsListening)
            {
                _listener.Stop();
            }
            _listener.Close();
        }
    }

    internal sealed class BridgeRequest
    {
        public readonly ManualResetEventSlim Done = new ManualResetEventSlim(false);
        public string Command = string.Empty;
        public bool Ok;
        public string FullName = string.Empty;
        public string Json = string.Empty;
    }

    internal sealed class RevitRequestHandler : IExternalEventHandler
    {
        private readonly ConcurrentQueue<BridgeRequest> _requests = new ConcurrentQueue<BridgeRequest>();

        public void Enqueue(BridgeRequest request)
        {
            _requests.Enqueue(request);
        }

        public void Execute(UIApplication app)
        {
            BridgeRequest request;
            while (_requests.TryDequeue(out request))
            {
                try
                {
                    var uidoc = app.ActiveUIDocument;
                    Document doc = uidoc == null ? null : uidoc.Document;
                    if (doc == null)
                    {
                        request.Ok = false;
                        request.Json = "{\"ok\":false,\"program\":\"Revit\",\"target\":\"revit\",\"connectedToProgram\":true,\"activeFile\":\"\",\"message\":\"No active Revit document.\"}";
                    }
                    else if (request.Command == "revit.list_levels")
                    {
                        request.Ok = true;
                        request.Json = BuildLevelsJson(doc);
                    }
                    else
                    {
                        var title = doc.Title ?? string.Empty;
                        var path = doc.PathName ?? string.Empty;
                        request.Ok = true;
                        request.FullName = path;
                        request.Json =
                            "{\"ok\":true,\"program\":\"Revit\",\"target\":\"revit\",\"connectedToProgram\":true," +
                            "\"activeFile\":\"" + BridgeHttpServer.EscapeJson(path) + "\"," +
                            "\"document\":{\"name\":\"" + BridgeHttpServer.EscapeJson(title) + "\"," +
                            "\"fullName\":\"" + BridgeHttpServer.EscapeJson(path) + "\"," +
                            "\"path\":\"" + BridgeHttpServer.EscapeJson(path) + "\"}}";
                    }
                }
                catch (Exception ex)
                {
                    request.Ok = false;
                    request.Json = "{\"ok\":false,\"program\":\"Revit\",\"target\":\"revit\",\"connectedToProgram\":true,\"message\":\"" + BridgeHttpServer.EscapeJson(ex.Message) + "\"}";
                }
                finally
                {
                    request.Done.Set();
                }
            }
        }

        public string GetName()
        {
            return "AI Program Revit MCP Bridge active-file handler";
        }

        private static string BuildLevelsJson(Document doc)
        {
            var levelsJson = new StringBuilder();
            var count = 0;
            foreach (Level level in new FilteredElementCollector(doc).OfClass(typeof(Level)))
            {
                if (count > 0)
                {
                    levelsJson.Append(",");
                }

                levelsJson
                    .Append("{\"id\":\"")
                    .Append(BridgeHttpServer.EscapeJson(level.Id.Value.ToString(CultureInfo.InvariantCulture)))
                    .Append("\",\"name\":\"")
                    .Append(BridgeHttpServer.EscapeJson(level.Name))
                    .Append("\",\"elevationFeet\":")
                    .Append(level.Elevation.ToString(CultureInfo.InvariantCulture))
                    .Append("}");
                count++;
            }

            return "{\"ok\":true,\"program\":\"Revit\",\"target\":\"revit\",\"command\":\"revit.list_levels\",\"count\":" +
                count.ToString(CultureInfo.InvariantCulture) +
                ",\"levels\":[" + levelsJson + "]}";
        }
    }
}
