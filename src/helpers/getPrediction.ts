import { fen2intArray } from "../../chss-module-engine/src/engine_new/transformers/fen2intArray";
import { move2moveString } from "../../chss-module-engine/src/engine_new/transformers/move2moveString";
import { generateLegalMoves } from "../../chss-module-engine/src/engine_new/moveGenerators/generateLegalMoves";
import {
  predictMove,
  // getWinnerPredictor,
} from "../../chss-module-engine/src/engine_new/tfHelpers/predict";
import * as tf from "@tensorflow/tfjs-node";
import { getModelGetter } from "./getModelGetter";
import { getMultiDepthMinimaxVals } from "./getMultiDepthMinimaxVals";
import { EngineConfig } from "../types/EngineConfig";
import { getNextBoards } from "./getNextBoards";

const moveModelPath = `models/move_predictor/tfjs/model.json`;
const getMoveModel = getModelGetter(moveModelPath);

// const winnerModelPath = `models/winner_predictor/tfjs/model.json`;
// const getWinnerModel = getModelGetter(winnerModelPath);

const MIN_DEPTH = 0;
const DEFAULT_MAX_DEPTH = 15;
const DEFAULT_TIMEOUT = 3000;
const DEFAULT_MOVE_SCORE_RATIO = 4;
const DEFAULT_WINNER_SCORE_RATIO = 0.3;

export const getPrediction = async ({
  fen,
  lmf,
  lmt,
  engineConfig,
}: {
  fen: string;
  lmf: number[];
  lmt: number[];
  moveIndex: number;
  engineConfig: EngineConfig;
}) => {
  const {
    moveSorters = [],
    maxDepth = DEFAULT_MAX_DEPTH,
    timeout = DEFAULT_TIMEOUT,
    moveScoreRario = DEFAULT_MOVE_SCORE_RATIO,
    winnerScoreRario = DEFAULT_WINNER_SCORE_RATIO,
  } = engineConfig;

  const started = Date.now();

  const board = fen2intArray(fen);
  const nextMoves = generateLegalMoves(board);

  // const winnerModel = await getWinnerModel();
  // const winnerPredictor = getWinnerPredictor({ tf, model: winnerModel });

  // const { winnerValue: originalWinningValue } = await winnerPredictor({
  //   board,
  //   lmf,
  //   lmt,
  // });

  if (!nextMoves.length) {
    return {
      winningMove: null,
      winningMoveString: null,
      noValidMoves: true,
      success: true,
      // originalWinningValue,
    };
  }

  if (nextMoves.length === 1) {
    return {
      winningMove: nextMoves[0],
      winningMoveString: move2moveString(nextMoves[0]),
      onlyMove: true,
      success: true,
      // originalWinningValue,
    };
  }

  const moveModel = await getMoveModel();

  const gotModelsAt = Date.now();

  const nextBoards = getNextBoards({ board, lmf, lmt, nextMoves });

  const modelPrediction = await predictMove({
    board,
    lmf,
    lmt,
    moveModel,
    // winnerModel,
    tf,
    nextBoards,
    moveScoreRario,
    // winnerScoreRario,
  });

  const gotModelPredictionAt = Date.now();

  if (maxDepth === 0) {
    return {
      ...modelPrediction,
      success: true,
      modelLoadTime: gotModelsAt - started,
      modelPredictTime: gotModelPredictionAt - gotModelsAt,
      depth: 0,
      maxDepth,
      // originalWinningValue,
    };
  }

  const minimaxVals = await getMultiDepthMinimaxVals({
    modelPrediction,
    board,
    lmf,
    lmt,
    maxDepth,
    moveSorters,
    startingDepth: 5,
    timeout,
  });

  const winningMoveIndex = modelPrediction.sortedMoves.findIndex(
    ({ move }) => move === minimaxVals.winningMove
  );

  return {
    ...modelPrediction,
    success: true,
    modelLoadTime: gotModelsAt - started,
    modelPredictTime: gotModelPredictionAt - gotModelsAt,
    minimaxTime: Date.now() - gotModelPredictionAt,
    ...minimaxVals,
    winningMoveIndex,
    winningMoveScoreRatio:
      modelPrediction.sortedMoves[winningMoveIndex].score /
      modelPrediction.sortedMoves[0].score,
    maxDepth,
    // originalWinningValue,
  };
};
