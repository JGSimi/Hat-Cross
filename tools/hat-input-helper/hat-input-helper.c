#include <ApplicationServices/ApplicationServices.h>
#include <CoreFoundation/CoreFoundation.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <unistd.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int trusted(void) {
  return AXIsProcessTrusted() ? 1 : 0;
}

static int prompt_accessibility(void) {
  const void *keys[] = { kAXTrustedCheckOptionPrompt };
  const void *values[] = { kCFBooleanTrue };
  CFDictionaryRef options = CFDictionaryCreate(
    kCFAllocatorDefault,
    keys,
    values,
    1,
    &kCFTypeDictionaryKeyCallBacks,
    &kCFTypeDictionaryValueCallBacks
  );
  if (!options) return trusted();
  Boolean ok = AXIsProcessTrustedWithOptions(options);
  CFRelease(options);
  return ok ? 1 : trusted();
}

static int post_click(double x, double y) {
  if (!trusted()) return 0;
  CGPoint p = CGPointMake(x, y);
  CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, p, kCGMouseButtonLeft);
  CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, p, kCGMouseButtonLeft);
  if (!down || !up) {
    if (down) CFRelease(down);
    if (up) CFRelease(up);
    return 0;
  }
  CGEventPost(kCGHIDEventTap, down);
  CGEventPost(kCGHIDEventTap, up);
  CFRelease(down);
  CFRelease(up);
  return 1;
}

static int post_paste(void) {
  if (!trusted()) return 0;
  CGEventRef down = CGEventCreateKeyboardEvent(NULL, (CGKeyCode)9, true);
  CGEventRef up = CGEventCreateKeyboardEvent(NULL, (CGKeyCode)9, false);
  if (!down || !up) {
    if (down) CFRelease(down);
    if (up) CFRelease(up);
    return 0;
  }
  CGEventSetFlags(down, kCGEventFlagMaskCommand);
  CGEventSetFlags(up, kCGEventFlagMaskCommand);
  CGEventPost(kCGHIDEventTap, down);
  CGEventPost(kCGHIDEventTap, up);
  CFRelease(down);
  CFRelease(up);
  return 1;
}

static void reply(int fd, const char *s) {
  (void)write(fd, s, strlen(s));
}

static void handle_client(int fd) {
  char buf[512];
  ssize_t n = read(fd, buf, sizeof(buf) - 1);
  if (n <= 0) return;
  buf[n] = '\0';

  if (strncmp(buf, "TRUST", 5) == 0) {
    reply(fd, trusted() ? "1\n" : "0\n");
    return;
  }
  if (strncmp(buf, "PROMPT", 6) == 0) {
    reply(fd, prompt_accessibility() ? "1\n" : "0\n");
    return;
  }
  if (strncmp(buf, "PASTE", 5) == 0) {
    reply(fd, post_paste() ? "OK\n" : "ERR\n");
    return;
  }
  if (strncmp(buf, "CLICK ", 6) == 0) {
    double x = 0.0, y = 0.0;
    if (sscanf(buf + 6, "%lf %lf", &x, &y) == 2 && post_click(x, y)) {
      reply(fd, "OK\n");
    } else {
      reply(fd, "ERR\n");
    }
    return;
  }
  reply(fd, "ERR\n");
}

int main(int argc, char **argv) {
  if (argc != 3 || strcmp(argv[1], "--socket") != 0) return 64;
  const char *socket_path = argv[2];
  if (strlen(socket_path) >= sizeof(((struct sockaddr_un *)0)->sun_path)) return 65;

  signal(SIGPIPE, SIG_IGN);

  int server = socket(AF_UNIX, SOCK_STREAM, 0);
  if (server < 0) return 66;
  unlink(socket_path);

  struct sockaddr_un addr;
  memset(&addr, 0, sizeof(addr));
  addr.sun_family = AF_UNIX;
  strncpy(addr.sun_path, socket_path, sizeof(addr.sun_path) - 1);

  if (bind(server, (struct sockaddr *)&addr, sizeof(addr)) != 0) {
    close(server);
    return 67;
  }
  chmod(socket_path, S_IRUSR | S_IWUSR);

  if (listen(server, 8) != 0) {
    close(server);
    unlink(socket_path);
    return 68;
  }

  for (;;) {
    int client = accept(server, NULL, NULL);
    if (client < 0) continue;
    handle_client(client);
    close(client);
  }
}
