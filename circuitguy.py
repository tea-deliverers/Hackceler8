#!/usr/bin/env python3
"""
pip install typer pytiled-parser z3-solver
Usage:
  ./circuitguy.py <path to game map>
"""

from typing import Dict, List, Optional, Type, Union
import pytiled_parser
import pathlib
import typer
import logging
import functools
import z3


logger = logging.getLogger()


class Node:
  _registry: Dict[str, Type] = {}
  inputs: List["Node"] = []
  __list_as_dest__ = False

  def __init__(self, name: str, inputs: List["Node"], **kwargs):
    self.name = name
    self.inputs_name = inputs

  def __init_subclass__(cls, **kwargs) -> None:
      super().__init_subclass__(**kwargs)
      if hasattr(cls, "__object_type__"):
        Node._registry[cls.__object_type__] = cls

  def _sanity_check(self) -> None:
    pass

  def smt_output(self):
    raise NotImplementedError(f"smt_output not implemented on {self.__class__.__name__}")

  @property
  def input(self) -> "Node":
    if len(self.inputs) != 1:
      raise ValueError(f"{self.name} has {len(self.inputs)} inputs, expected 1")
    return self.inputs[0]

  @classmethod
  def from_tiled_object(cls, tile: pytiled_parser.Tile) -> "Node":
    inputs = tile.properties["input"].split("\n")
    return cls(tile.name, inputs)
  
  @staticmethod
  def is_known_object(tile: pytiled_parser.Tile) -> bool:
    return tile.type in Node._registry

  @staticmethod
  def parse_tile(tile: pytiled_parser.Tile) -> "Node":
    return Node._registry[tile.type].from_tiled_object(tile)


class InputNode(Node):
  @classmethod
  def from_tiled_object(cls, tile: pytiled_parser.Tile) -> "Node":
      return cls(tile.name, [])

  @functools.cache
  def smt_output(self):
    return z3.BitVec(self.name, 1)


class KeyReceptacle(InputNode):
  __object_type__ = "KeyReceptacle"


class Control(InputNode):
  __object_type__ = "Control"


class CircuitNode(Node):
  @classmethod
  def from_tiled_object(cls, tile: pytiled_parser.Tile) -> "Node":
    result = super().from_tiled_object(tile)
    result.frame_state = tile.properties["frame_state"]
    return result


class Toggle(CircuitNode):
  __object_type__ = "Toggle"
  _var: Optional[z3.BitVecRef] = None

  def _sanity_check(self) -> None:
    if len(self.input.inputs) != 0:
      raise ValueError(f"Rule violation: Extender {self.name}'s input {self.input.name} has input")

  @functools.cache
  def smt_output(self):
    return z3.BitVec(self.name, 1)


class Extender(CircuitNode):
  __object_type__ = "Extender"

  def _sanity_check(self) -> None:
    if len(self.input.inputs) != 0:
      raise ValueError(f"Rule violation: Extender {self.name}'s input {self.input.name} has input")

  @functools.cache
  def smt_output(self):
    return z3.BitVec(self.name, 1)


class ForcedInputNode(CircuitNode):
  @functools.cache
  def smt_output(self):
    return z3.BitVec(self.name, 1)


class Wire(CircuitNode):
  __object_type__ = "Wire"

  def _sanity_check(self) -> None:
    if len(self.inputs) != 1:
      raise ValueError(f"{self.name} has {len(self.inputs)} inputs, expected 1")

  @functools.cache
  def smt_output(self):
    return self.input.smt_output()


class AndGate(CircuitNode):
  __object_type__ = "And"

  def _sanity_check(self) -> None:
    if len(self.inputs) != 2:
      raise ValueError(f"{self.name} has {len(self.inputs)} inputs, expected 2")

  @functools.cache
  def smt_output(self):
    return self.inputs[0].smt_output() & self.inputs[1].smt_output()


class NotGate(CircuitNode):
  __object_type__ = "Inverter"

  def _sanity_check(self) -> None:
    if len(self.inputs) != 1:
      raise ValueError(f"{self.name} has {len(self.inputs)} inputs, expected 1")
  
  @functools.cache
  def smt_output(self):
    return ~self.input.smt_output()


# Dest Node
class Door(Node):
  __object_type__ = "Door"
  __list_as_dest__ = True

  def _sanity_check(self) -> None:
    if len(self.inputs) != 1:
      raise ValueError(f"{self.name} has {len(self.inputs)} inputs, expected 1")

  def smt_solve(self, solver: z3.Solver):
    solver.add(self.input.smt_output() == 1)


class Graph:
  object_by_id: Dict[int, pytiled_parser.Tile]
  object_by_name: Dict[str, pytiled_parser.Tile]
  graph: Dict[str, Node]
  finalized: bool

  def __init__(self):
    self.object_by_id = {}
    self.object_by_name = {}
    self.graph = {}
    self.finalized = False

  def add_tile(self, tile: pytiled_parser.Tile) -> None:
    if not Node.is_known_object(tile):
      return
    if tile.id in self.graph:
      raise ValueError(f"Duplicate tile id {tile.id}")
    self.object_by_id[tile.id] = tile
    if not tile.name:
      logger.debug(f"Ignoring unnamed tile {tile.id} (Type: {tile.type})")
      return
    if tile.name in self.graph:
      raise ValueError(f"Duplicate object name {tile.name}")
    self.object_by_name[tile.name] = tile
    self.graph[tile.name] = Node.parse_tile(tile)

  def mark_as_input(self, name):
    assert name in self.graph
    self.graph[name] = ForcedInputNode(name, [])

  def build(self):
    if self.finalized:
      raise ValueError("Graph already finalized")
    for name, node in self.graph.items():
      for name in node.inputs_name:
        if name not in self.graph:
          raise ValueError(f"missing input {name} (referenced by {node.name})")
      node.inputs = [self.graph[input_name] for input_name in node.inputs_name]
      node._sanity_check()
    self.finalized = True

  def dest_nodes(self):
    return [node for node in self.graph.values() if node.__class__.__list_as_dest__]

  def solve(self, node: List[Union[str, Node]]):
    solver = z3.Solver()
    for dest in node:
      if isinstance(dest, str):
        dest = self.graph[dest]
      dest.smt_solve(solver)
    if not solver.check():
      raise RuntimeError("Unsatisfiable")
    return solver.model()


def main(map_file: pathlib.Path, *, force_input: List[str] = []):
  tmap = pytiled_parser.parse_map(map_file)
  typer.echo(f"Loaded map {map_file} (generated by {tmap.tiled_version})")
  typer.echo("Object layers:")
  g = Graph()
  for layer in tmap.layers:
    if not isinstance(layer, pytiled_parser.ObjectLayer):
      continue
    typer.echo(f"  {layer.name}")
    for tile in layer.tiled_objects:
      g.add_tile(tile)
  g.build()
  typer.echo(f"Parsed {len(g.object_by_id)} objects, {len(g.object_by_name)} named ones and {len(g.graph)} circuit-related.")

  typer.echo("Doors:")
  for node in g.dest_nodes():
    typer.echo(f"  {node.name}")

  names = []
  while True:
    name = typer.prompt(f"Door to open (empty to quit)", default="")
    if not name:
      break
    if name not in g.graph:
      typer.echo(f"Unknown door {name}")
      continue
    names.append(name)
  for name in force_input:
    g.mark_as_input(name)
  model = g.solve(names)
  print(model)


if __name__ == "__main__":
  typer.run(main)
