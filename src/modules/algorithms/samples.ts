import type { Algorithm } from './types'
import { createAlgorithmId } from './types'

export function makePythonBubbleSort(): Algorithm {
  const now = Date.now()
  return {
    id: createAlgorithmId(),
    title: '冒泡排序（Python）',
    description: 'Python + tracers 可视化冒泡排序。',
    language: 'python',
    category: '排序',
    tags: ['python', 'sort'],
    favorite: false,
    createdAt: now,
    updatedAt: now,
    source: 'user',
    files: [
      {
        name: 'bubble_sort.py',
        content: `# Worktable Python runtime injects tracers automatically
# Available: Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout

array1d = Array1DTracer("数组")
log = LogTracer("日志")
A = [5, 2, 9, 1, 5, 6]

def main():
    Layout.setRoot(VerticalLayout([array1d, log]))
    array1d.set(A)
    Tracer.delay()
    n = len(A)
    for i in range(n - 1):
        for j in range(n - 1 - i):
            array1d.select(j, j + 1)
            log.println(f"比较 A[{j}]={A[j]} 与 A[{j+1}]={A[j+1]}")
            Tracer.delay()
            if A[j] > A[j + 1]:
                array1d.patch(j, A[j + 1])
                array1d.patch(j + 1, A[j])
                A[j], A[j + 1] = A[j + 1], A[j]
                log.println("交换")
                Tracer.delay()
                array1d.depatch(j)
                array1d.depatch(j + 1)
            array1d.deselect(j, j + 1)
    log.println("完成: " + ", ".join(str(x) for x in A))
    Tracer.delay()

main()
`,
      },
    ],
  }
}

export function makeCppBubbleSort(): Algorithm {
  const now = Date.now()
  return {
    id: 'cpp-bubble-sort',
    title: '冒泡排序（C++）',
    description: '使用本机 C++ 编译器运行；需在设置中配置编译器。',
    language: 'cpp',
    category: '排序',
    tags: ['cpp', 'sort'],
    favorite: false,
    createdAt: now,
    updatedAt: now,
    source: 'builtin',
    files: [
      {
        name: 'bubble_sort.cpp',
        content: `#include "av.h"
#include <vector>
using namespace av;

int main() {
  Array1DTracer array1d("数组");
  LogTracer log("日志");
  std::vector<int> A = {5, 2, 9, 1, 5, 6};

  VerticalLayout layout({&array1d, &log});
  Layout.setRoot(layout);
  array1d.set(A);
  Tracer::delay(14);

  int n = (int)A.size();
  for (int i = 0; i < n - 1; ++i) {
    for (int j = 0; j < n - 1 - i; ++j) {
      array1d.select(j, j + 1);
      Tracer::delay(18);
      if (A[j] > A[j + 1]) {
        array1d.patch(j, A[j + 1]);
        array1d.patch(j + 1, A[j]);
        std::swap(A[j], A[j + 1]);
        Tracer::delay(22);
        array1d.depatch(j);
        array1d.depatch(j + 1);
      }
      array1d.deselect(j, j + 1);
    }
  }
  return 0;
}
`,
      },
    ],
  }
}
