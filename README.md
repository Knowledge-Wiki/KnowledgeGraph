# mediawiki-extensions-KnowledgeGraph

Visualizes SemanticMediawiki data with VisNetwork.js
Includes a KnowledgeGraph Designer through which interactively create/export graphs.

## Usage

Insert a parser function like

```
{{#knowledgegraph:
nodes=Page A, Page B
|properties=HasProperty1,HasProperty2
|depth=3
|graph-options=Mediawiki:knowledgegraphGraphOptions
|property-options?HasProperty1=Mediawiki:knowledgegraphNodeOptionsHasProperty1
|show-toolbar=false
|show-property-type=false
|width=100%
|height=400px
}}
```


## Credits
https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph


