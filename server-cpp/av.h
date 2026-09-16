#pragma once
#include <algorithm>
#include <iostream>
#include <random>
#include <sstream>
#include <string>
#include <vector>

namespace av {

inline std::string key() {
  static const char* letters = "abcdefghijklmnopqrstuvwxyz0123456789";
  static std::mt19937 rng{std::random_device{}()};
  std::uniform_int_distribution<int> d(0, 35);
  std::string s;
  for (int i = 0; i < 8; ++i) s.push_back(letters[d(rng)]);
  return s;
}

inline void emit(const std::string& k, const std::string& method, const std::string& args_json) {
  std::cout << "AVCMD{\"key\":";
  if (k.empty()) std::cout << "null";
  else std::cout << "\"" << k << "\"";
  std::cout << ",\"method\":\"" << method << "\",\"args\":" << args_json << "}" << std::endl;
}

inline std::string jstr(const std::string& s) {
  std::ostringstream o;
  o << '"';
  for (char c : s) {
    if (c == '"' || c == '\\') o << '\\' << c;
    else if (c == '\n') o << "\\n";
    else o << c;
  }
  o << '"';
  return o.str();
}

class Tracer {
public:
  std::string k;
  Tracer(const std::string& cls, const std::string& title = "") {
    k = key();
    std::string args = title.empty() ? "[]" : ("[" + jstr(title) + "]");
    emit(k, cls, args);
  }
  static void delay(int line = -1) {
    if (line < 0) emit("", "delay", "[]");
    else emit("", "delay", "[" + std::to_string(line) + "]");
  }
};

class LogTracer : public Tracer {
public:
  LogTracer(const std::string& title = "Log") : Tracer("LogTracer", title) {}
  void println(const std::string& msg) { emit(k, "println", "[" + jstr(msg) + "]"); }
  void print(const std::string& msg) { emit(k, "print", "[" + jstr(msg) + "]"); }
};

class Array1DTracer : public Tracer {
public:
  Array1DTracer(const std::string& title = "Array") : Tracer("Array1DTracer", title) {}
  void set(const std::vector<int>& a) {
    std::ostringstream o;
    o << "[[";
    for (size_t i = 0; i < a.size(); ++i) {
      if (i) o << ",";
      o << a[i];
    }
    o << "]]";
    emit(k, "set", o.str());
  }
  void select(int sx, int ex = -2) {
    if (ex == -2) emit(k, "select", "[" + std::to_string(sx) + "]");
    else emit(k, "select", "[" + std::to_string(sx) + "," + std::to_string(ex) + "]");
  }
  void deselect(int sx, int ex = -2) {
    if (ex == -2) emit(k, "deselect", "[" + std::to_string(sx) + "]");
    else emit(k, "deselect", "[" + std::to_string(sx) + "," + std::to_string(ex) + "]");
  }
  void patch(int x, int v) { emit(k, "patch", "[" + std::to_string(x) + "," + std::to_string(v) + "]"); }
  void depatch(int x) { emit(k, "depatch", "[" + std::to_string(x) + "]"); }
};

class VerticalLayout {
public:
  std::string k;
  VerticalLayout(std::initializer_list<Tracer*> children) {
    k = key();
    std::ostringstream o;
    o << "[[";
    bool first = true;
    for (Tracer* t : children) {
      if (!first) o << ",";
      first = false;
      o << jstr(t->k);
    }
    o << "]]";
    emit(k, "VerticalLayout", o.str());
  }
};

class Layout {
public:
  static void setRoot(VerticalLayout& layout) {
    emit("", "setRoot", "[" + jstr(layout.k) + "]");
  }
  static void setRoot(Tracer& t) {
    emit("", "setRoot", "[" + jstr(t.k) + "]");
  }
};

}  // namespace av
