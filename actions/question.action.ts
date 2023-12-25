"use server";

import Question from "@/database/question.model";
import Tag from "@/database/tag.model";
import User from "@/database/user.model";
import { FilterQuery } from "mongoose";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "../lib/mongoose";
import {
  CreateQuestionParams,
  DeleteQuestionParams,
  EditQuestionParams,
  GetQuestionByIdParams,
  QuestionVoteParams,
} from "./shared.types";
import { voting } from "./commonActions";
import Answer from "@/database/answer.model";
import Interaction from "@/database/interaction.model";

export async function getQuestions() {
  try {
    connectToDatabase();

    const query: FilterQuery<typeof Question> = {};

    const questions = await Question.find(query)
      .populate({
        path: "tags",
        model: Tag,
      })
      .populate({ path: "author", model: User });

    return questions;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getQuestionsById(params: GetQuestionByIdParams) {
  try {
    connectToDatabase();

    const { questionId } = params;

    const question = await Question.findById(questionId)
      .populate({ path: "tags", model: Tag, select: "_id name" })
      .populate({
        path: "author",
        model: User,
        select: "_id name picture clerkId",
      });

    return question;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function createQuestion(params: CreateQuestionParams) {
  try {
    connectToDatabase();
    const { title, content, tags, author, path } = params;

    const question = await Question.create({
      title,
      content,
      author,
    });

    const tagDoc = [];
    for (const tag of tags) {
      const existingTag = await Tag.findOneAndUpdate(
        {
          name: {
            $regex: new RegExp(`^${tag}$`, "i"),
          },
        },
        { $setOnInsert: { name: tag }, $push: { questions: question._id } },
        { upsert: true, new: true }
      );
      tagDoc.push(existingTag._id);
    }

    await Question.findByIdAndUpdate(question._id, {
      $push: { tags: { $each: tagDoc } },
    });

    revalidatePath(path);
  } catch (error) {
    console.log(error);
  }
}

export const editQuestion = async (params: EditQuestionParams) => {
  try {
    connectToDatabase();

    const { questionId, title, content, path } = params;

    const question = await Question.findById(questionId).populate("tags");

    if (!question) {
      throw new Error("No question found");
    }
    question.title = title;
    question.content = content;

    await question.save();
    revalidatePath(path);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const deleteQuestion = async (params: DeleteQuestionParams) => {
  try {
    connectToDatabase();
    const { questionId, path } = params;

    const question = await Question.findById(questionId);
    if (!question) throw new Error("No answer found");

    await Question.deleteOne({ _id: questionId });
    await Answer.deleteMany({ question: questionId });
    await Interaction.deleteMany({ question: questionId });
    await Tag.updateMany(
      { questions: questionId },
      { $pull: { questions: questionId } }
    );

    revalidatePath(path);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const upvoteQuestion = async (params: QuestionVoteParams) => {
  try {
    connectToDatabase();

    const { questionId, userId, hasupVoted, path, hasdownVoted } = params;

    await voting({
      id: questionId,
      userId,
      hasupVoted,
      hasdownVoted,
      type: "question",
      vote: "up",
    });

    revalidatePath(path);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const downVoteQuestion = async (params: QuestionVoteParams) => {
  try {
    connectToDatabase();

    const { questionId, userId, hasupVoted, path, hasdownVoted } = params;

    await voting({
      id: questionId,
      userId,
      hasupVoted,
      hasdownVoted,
      type: "question",
      vote: "down",
    });

    revalidatePath(path);
  } catch (error) {
    console.log(error);
    throw error;
  }
};
