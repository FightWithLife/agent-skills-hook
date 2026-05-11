# 图形方法示例

说明：这里展示的是通用画图方法本身，业务 skill 只负责说明要画什么。

Source: examples/26-05-03_diagram-workflow-overview.puml

```text
                                     Diagram Workflow Overview                                 
                                                                                               
         ,-.                                                                                   
         `-'                                                                                   
         /|\                                                                                   
          |               ,----------------.          ,---------------.          ,------------.
         / \              |diagram-workflow|          |PlantUML source|          |ASCII render|
      Developer           `-------+--------'          `-------+-------'          `-----+------'
          |   request diagram     |                           |                        |       
          |---------------------->|                           |                        |       
          |                       |                           |                        |       
          |                       |       write source        |                        |       
          |                       | ------------------------->|                        |       
          |                       |                           |                        |       
          |                       |----.                      |                        |       
          |                       |    | choose diagram type  |                        |       
          |                       |<---'                      |                        |       
          |                       |                           |                        |       
          |                       |                 render text diagram                |       
          |                       | --------------------------------------------------->       
          |                       |                           |                        |       
          |  review and refine    |                           |                        |       
          |<- - - - - - - - - - - |                           |                        |       
      Developer           ,-------+--------.          ,-------+-------.          ,-----+------.
         ,-.              |diagram-workflow|          |PlantUML source|          |ASCII render|
         `-'              `----------------'          `---------------'          `------------'
         /|\                                                                                   
          |                                                                                    
         / \
```
