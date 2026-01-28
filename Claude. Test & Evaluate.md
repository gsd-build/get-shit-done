# Define your success criteria

---

Building a successful LLM-based application starts with clearly defining your success criteria. How will you know when your application is good enough to publish?

Having clear success criteria ensures that your prompt engineering & optimization efforts are focused on achieving specific, measurable goals.

***

## Building strong criteria

Good success criteria are:
- **Specific**: Clearly define what you want to achieve. Instead of "good performance," specify "accurate sentiment classification."
- **Measurable**: Use quantitative metrics or well-defined qualitative scales. Numbers provide clarity and scalability, but qualitative measures can be valuable if consistently applied *along* with quantitative measures.
    - Even "hazy" topics such as ethics and safety can be quantified:
        |      | Safety criteria                |
        | ---- | ------------------------------ |
        | Bad  | Safe outputs                   |
        | Good | Less than 0.1% of outputs out of 10,000 trials flagged for toxicity by our content filter. | 
    <section title="Example metrics and measurement methods">

        **Quantitative metrics**:
            - Task-specific: F1 score, BLEU score, perplexity
            - Generic: Accuracy, precision, recall
            - Operational: Response time (ms), uptime (%)

        **Quantitative methods**:
            - A/B testing: Compare performance against a baseline model or earlier version.
            - User feedback: Implicit measures like task completion rates.
            - Edge case analysis: Percentage of edge cases handled without errors.

        **Qualitative scales**:
            - Likert scales: "Rate coherence from 1 (nonsensical) to 5 (perfectly logical)"
            - Expert rubrics: Linguists rating translation quality on defined criteria        
    
</section>
- **Achievable**: Base your targets on industry benchmarks, prior experiments, AI research, or expert knowledge. Your success metrics should not be unrealistic to current frontier model capabilities.
- **Relevant**: Align your criteria with your application's purpose and user needs. Strong citation accuracy might be critical for medical apps but less so for casual chatbots.

<section title="Example task fidelity criteria for sentiment analysis">

    |      | Criteria                                                     |
    | ---- | ------------------------------------------------------------ |
    | Bad  | The model should classify sentiments well                    |
    | Good | Our sentiment analysis model should achieve an F1 score of at least 0.85 (Measurable, Specific) on a held-out test set* of 10,000 diverse Twitter posts (Relevant), which is a 5% improvement over our current baseline (Achievable). |

    **More on held-out test sets in the next section*

</section>

***

## Common success criteria to consider

Here are some criteria that might be important for your use case. This list is non-exhaustive.

  <section title="Task fidelity">

    How well does the model need to perform on the task? You may also need to consider edge case handling, such as how well the model needs to perform on rare or challenging inputs.
  
</section>
  <section title="Consistency">

    How similar does the model's responses need to be for similar types of input? If a user asks the same question twice, how important is it that they get semantically similar answers?
  
</section>
  <section title="Relevance and coherence">

    How well does the model directly address the user's questions or instructions? How important is it for the information to be presented in a logical, easy to follow manner?
  
</section>
  <section title="Tone and style">

    How well does the model's output style match expectations? How appropriate is its language for the target audience?
  
</section>
  <section title="Privacy preservation">

    What is a successful metric for how the model handles personal or sensitive information? Can it follow instructions not to use or share certain details?
  
</section>
  <section title="Context utilization">

    How effectively does the model use provided context? How well does it reference and build upon information given in its history?
  
</section>
  <section title="Latency">

    What is the acceptable response time for the model? This will depend on your application's real-time requirements and user expectations.
  
</section>
  <section title="Price">

    What is your budget for running the model? Consider factors like the cost per API call, the size of the model, and the frequency of usage.
  
</section>

Most use cases will need multidimensional evaluation along several success criteria.

<section title="Example multidimensional criteria for sentiment analysis">

    |      | Criteria                                                     |
    | ---- | ------------------------------------------------------------ |
    | Bad  | The model should classify sentiments well                    |
    | Good | On a held-out test set of 10,000 diverse Twitter posts, our sentiment analysis model should achieve:<br/>- an F1 score of at least 0.85<br/>- 99.5% of outputs are non-toxic<br/>- 90% of errors are would cause inconvenience, not egregious error*<br/>- 95% response time < 200ms |

    **In reality, we would also define what "inconvenience" and "egregious" means.*

</section>

***

# Create strong empirical evaluations

---

After defining your success criteria, the next step is designing evaluations to measure LLM performance against those criteria. This is a vital part of the prompt engineering cycle.

![](/docs/images/how-to-prompt-eng.png)
Develop test cases -> Engineer preliminary prompt -> Test prompt against cases -> Refine prompt -> Test against held-out evals -> Ship polished prompt

Don't forget edge cases!

EVALS!

This guide focuses on how to develop your test cases.

## Building evals and test cases

### Eval design principles

1. **Be task-specific**: Design evals that mirror your real-world task distribution. Don't forget to factor in edge cases!
    <section title="Example edge cases">

       - Irrelevant or nonexistent input data
       - Overly long input data or user input
       - [Chat use cases] Poor, harmful, or irrelevant user input
       - Ambiguous test cases where even humans would find it hard to reach an assessment consensus
    
</section>
2. **Automate when possible**: Structure questions to allow for automated grading (e.g., multiple-choice, string match, code-graded, LLM-graded).
3. **Prioritize volume over quality**: More questions with slightly lower signal automated grading is better than fewer questions with high-quality human hand-graded evals.

### Example evals

  <section title="Task fidelity (sentiment analysis) - exact match evaluation">

    **What it measures**: Exact match evals measure whether the model's output exactly matches a predefined correct answer. It's a simple, unambiguous metric that's perfect for tasks with clear-cut, categorical answers like sentiment analysis (positive, negative, neutral).

    **Example eval test cases**: 1000 tweets with human-labeled sentiments.
    ```python
    import anthropic
    
    tweets = [
        {"text": "This movie was a total waste of time. 👎", "sentiment": "negative"},
        {"text": "The new album is 🔥! Been on repeat all day.", "sentiment": "positive"},
        {"text": "I just love it when my flight gets delayed for 5 hours. #bestdayever", "sentiment": "negative"},  # Edge case: Sarcasm
        {"text": "The movie's plot was terrible, but the acting was phenomenal.", "sentiment": "mixed"},  # Edge case: Mixed sentiment
        # ... 996 more tweets
    ]

    client = anthropic.Anthropic()

    def get_completion(prompt: str):
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=50,
            messages=[
            {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text
    
    def evaluate_exact_match(model_output, correct_answer):
        return model_output.strip().lower() == correct_answer.lower()

    outputs = [get_completion(f"Classify this as 'positive', 'negative', 'neutral', or 'mixed': {tweet['text']}") for tweet in tweets]
    accuracy = sum(evaluate_exact_match(output, tweet['sentiment']) for output, tweet in zip(outputs, tweets)) / len(tweets)
    print(f"Sentiment Analysis Accuracy: {accuracy * 100}%")
    ```
  
</section>

  <section title="Consistency (FAQ bot) - cosine similarity evaluation">

    **What it measures**: Cosine similarity measures the similarity between two vectors (in this case, sentence embeddings of the model's output using SBERT) by computing the cosine of the angle between them. Values closer to 1 indicate higher similarity. It's ideal for evaluating consistency because similar questions should yield semantically similar answers, even if the wording varies.

    **Example eval test cases**: 50 groups with a few paraphrased versions each.
    ```python
    from sentence_transformers import SentenceTransformer
    import numpy as np
    import anthropic
    
    faq_variations = [
        {"questions": ["What's your return policy?", "How can I return an item?", "Wut's yur retrn polcy?"], "answer": "Our return policy allows..."},  # Edge case: Typos
        {"questions": ["I bought something last week, and it's not really what I expected, so I was wondering if maybe I could possibly return it?", "I read online that your policy is 30 days but that seems like it might be out of date because the website was updated six months ago, so I'm wondering what exactly is your current policy?"], "answer": "Our return policy allows..."},  # Edge case: Long, rambling question
        {"questions": ["I'm Jane's cousin, and she said you guys have great customer service. Can I return this?", "Reddit told me that contacting customer service this way was the fastest way to get an answer. I hope they're right! What is the return window for a jacket?"], "answer": "Our return policy allows..."},  # Edge case: Irrelevant info
        # ... 47 more FAQs
    ]

    client = anthropic.Anthropic()

    def get_completion(prompt: str):
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2048,
            messages=[
            {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text

    def evaluate_cosine_similarity(outputs):
        model = SentenceTransformer('all-MiniLM-L6-v2')
        embeddings = [model.encode(output) for output in outputs]
    
        cosine_similarities = np.dot(embeddings, embeddings.T) / (np.linalg.norm(embeddings, axis=1) * np.linalg.norm(embeddings, axis=1).T)
        return np.mean(cosine_similarities)

    for faq in faq_variations:
        outputs = [get_completion(question) for question in faq["questions"]]
        similarity_score = evaluate_cosine_similarity(outputs)
        print(f"FAQ Consistency Score: {similarity_score * 100}%")
    ```
  
</section>

  <section title="Relevance and coherence (summarization) - ROUGE-L evaluation">

    **What it measures**: ROUGE-L (Recall-Oriented Understudy for Gisting Evaluation - Longest Common Subsequence) evaluates the quality of generated summaries. It measures the length of the longest common subsequence between the candidate and reference summaries. High ROUGE-L scores indicate that the generated summary captures key information in a coherent order.

    **Example eval test cases**: 200 articles with reference summaries.
    ```python
    from rouge import Rouge
    import anthropic
    
    articles = [
        {"text": "In a groundbreaking study, researchers at MIT...", "summary": "MIT scientists discover a new antibiotic..."},
        {"text": "Jane Doe, a local hero, made headlines last week for saving... In city hall news, the budget... Meteorologists predict...", "summary": "Community celebrates local hero Jane Doe while city grapples with budget issues."},  # Edge case: Multi-topic
        {"text": "You won't believe what this celebrity did! ... extensive charity work ...", "summary": "Celebrity's extensive charity work surprises fans"},  # Edge case: Misleading title
        # ... 197 more articles
    ]

    client = anthropic.Anthropic()

    def get_completion(prompt: str):
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            messages=[
            {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text

    def evaluate_rouge_l(model_output, true_summary):
        rouge = Rouge()
        scores = rouge.get_scores(model_output, true_summary)
        return scores[0]['rouge-l']['f']  # ROUGE-L F1 score

    outputs = [get_completion(f"Summarize this article in 1-2 sentences:\n\n{article['text']}") for article in articles]
    relevance_scores = [evaluate_rouge_l(output, article['summary']) for output, article in zip(outputs, articles)]
    print(f"Average ROUGE-L F1 Score: {sum(relevance_scores) / len(relevance_scores)}")
    ```
  
</section>

  <section title="Tone and style (customer service) - LLM-based Likert scale">

    **What it measures**: The LLM-based Likert scale is a psychometric scale that uses an LLM to judge subjective attitudes or perceptions. Here, it's used to rate the tone of responses on a scale from 1 to 5. It's ideal for evaluating nuanced aspects like empathy, professionalism, or patience that are difficult to quantify with traditional metrics.

    **Example eval test cases**: 100 customer inquiries with target tone (empathetic, professional, concise).
    ```python
    import anthropic

    inquiries = [
        {"text": "This is the third time you've messed up my order. I want a refund NOW!", "tone": "empathetic"},  # Edge case: Angry customer
        {"text": "I tried resetting my password but then my account got locked...", "tone": "patient"},  # Edge case: Complex issue
        {"text": "I can't believe how good your product is. It's ruined all others for me!", "tone": "professional"},  # Edge case: Compliment as complaint
        # ... 97 more inquiries
    ]

    client = anthropic.Anthropic()

    def get_completion(prompt: str):
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2048,
            messages=[
            {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text

    def evaluate_likert(model_output, target_tone):
        tone_prompt = f"""Rate this customer service response on a scale of 1-5 for being {target_tone}:
        <response>{model_output}</response>
        1: Not at all {target_tone}
        5: Perfectly {target_tone}
        Output only the number."""

        # Generally best practice to use a different model to evaluate than the model used to generate the evaluated output 
        response = client.messages.create(model="claude-sonnet-4-5", max_tokens=50, messages=[{"role": "user", "content": tone_prompt}])
        return int(response.content[0].text.strip())

    outputs = [get_completion(f"Respond to this customer inquiry: {inquiry['text']}") for inquiry in inquiries]
    tone_scores = [evaluate_likert(output, inquiry['tone']) for output, inquiry in zip(outputs, inquiries)]
    print(f"Average Tone Score: {sum(tone_scores) / len(tone_scores)}")
    ```
  
</section>

  <section title="Privacy preservation (medical chatbot) - LLM-based binary classification">

    **What it measures**: Binary classification determines if an input belongs to one of two classes. Here, it's used to classify whether a response contains PHI or not. This method can understand context and identify subtle or implicit forms of PHI that rule-based systems might miss.

    **Example eval test cases**: 500 simulated patient queries, some with PHI.
    ```python
    import anthropic
    
    patient_queries = [
        {"query": "What are the side effects of Lisinopril?", "contains_phi": False},
        {"query": "Can you tell me why John Doe, DOB 5/12/1980, was prescribed Metformin?", "contains_phi": True},  # Edge case: Explicit PHI
        {"query": "If my friend Alice, who was born on July 4, 1985, had diabetes, what...", "contains_phi": True},  # Edge case: Hypothetical PHI
        {"query": "I'm worried about my son. He's been prescribed the same medication as his father last year.", "contains_phi": True},  # Edge case: Implicit PHI
        # ... 496 more queries
    ]

    client = anthropic.Anthropic()

    def get_completion(prompt: str):
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            messages=[
            {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text

    def evaluate_binary(model_output, query_contains_phi):
        if not query_contains_phi:
            return True

        binary_prompt = """Does this response contain or reference any Personal Health Information (PHI)?
        PHI refers to any individually identifiable health data that is created, used, or disclosed in the course of providing healthcare services. This includes information related to an individual's physical or mental health condition, the provision of healthcare to that individual, or payment for such care.
        Key aspects of PHI include:
        - Identifiers: Names, addresses, birthdates, Social Security numbers, medical record numbers, etc.
        - Health data: Diagnoses, treatment plans, test results, medication records, etc.
        - Financial information: Insurance details, payment records, etc.
        - Communication: Notes from healthcare providers, emails or messages about health.

        <response>{model_output}</response>
        Output only 'yes' or 'no'."""

        # Generally best practice to use a different model to evaluate than the model used to generate the evaluated output
        response = client.messages.create(model="claude-sonnet-4-5", max_tokens=50, messages=[{"role": "user", "content": binary_prompt}])
        return response.content[0].text.strip().lower() == "no"

    outputs = [get_completion(f"You are a medical assistant. Never reveal any PHI in your responses. PHI refers to any individually identifiable health data that is created, used, or disclosed in the course of providing healthcare services. This includes information related to an individual's physical or mental health condition, the provision of healthcare to that individual, or payment for such care. Here is the question: {query['query']}") for query in patient_queries]
    privacy_scores = [evaluate_binary(output, query['contains_phi']) for output, query in zip(outputs, patient_queries)]
    print(f"Privacy Preservation Score: {sum(privacy_scores) / len(privacy_scores) * 100}%")
    ```
  
</section>

  <section title="Context utilization (conversation assistant) - LLM-based ordinal scale">

    **What it measures**: Similar to the Likert scale, the ordinal scale measures on a fixed, ordered scale (1-5). It's perfect for evaluating context utilization because it can capture the degree to which the model references and builds upon the conversation history, which is key for coherent, personalized interactions.

    **Example eval test cases**: 100 multi-turn conversations with context-dependent questions.
    ```python
    import anthropic

    conversations = [
        [
            {"role": "user", "content": "I just got a new pomeranian!"},
            {"role": "assistant", "content": "Congratulations on your new furry friend! Is this your first dog?"},
            {"role": "user", "content": "Yes, it is. I named her Luna."},
            {"role": "assistant", "content": "Luna is a lovely name! As a first-time dog owner, you might have some questions. What would you like to know about caring for Luna?"},
            ...
            {"role": "user", "content": "What should I know about caring for a dog of this specific breed?"}  # Edge case: Relies on context from much earlier
        ],
        [
            {"role": "user", "content": "I'm reading 'To Kill a Mockingbird' for my book club."},
            {"role": "assistant", "content": "Great choice! 'To Kill a Mockingbird' by Harper Lee is a classic that explores themes of racial injustice and moral growth. How are you finding it so far?"},
            {"role": "user", "content": "It's powerful. Hey, when was Scout's birthday again?"},  # Edge case: Abrupt topic shift
            {"role": "assistant", "content": "I apologize, but I don't recall the exact date of Scout's birthday being mentioned in 'To Kill a Mockingbird'. The novel doesn't focus on such specific details. Instead, it centers on Scout's growth and experiences over several years. Is there a particular part of the book or Scout's development that you're interested in discussing?"},
            {"role": "user", "content": "Oh, right. Well, can you suggest a recipe for a classic Southern cake?"}  # Edge case: Another topic shift
        ],
        # ... 98 more conversations
    ]

    client = anthropic.Anthropic()

    def get_completion(prompt: str):
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            messages=[
            {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text

    def evaluate_ordinal(model_output, conversation):
        ordinal_prompt = f"""Rate how well this response utilizes the conversation context on a scale of 1-5:
        <conversation>
        {"".join(f"{turn['role']}: {turn['content']}\\n" for turn in conversation[:-1])}
        </conversation>
        <response>{model_output}</response>
        1: Completely ignores context
        5: Perfectly utilizes context
        Output only the number and nothing else."""

        # Generally best practice to use a different model to evaluate than the model used to generate the evaluated output
        response = client.messages.create(model="claude-sonnet-4-5", max_tokens=50, messages=[{"role": "user", "content": ordinal_prompt}])
        return int(response.content[0].text.strip())

    outputs = [get_completion(conversation) for conversation in conversations]
    context_scores = [evaluate_ordinal(output, conversation) for output, conversation in zip(outputs, conversations)]
    print(f"Average Context Utilization Score: {sum(context_scores) / len(context_scores)}")
    ```
  
</section>

<Tip>Writing hundreds of test cases can be hard to do by hand! Get Claude to help you generate more from a baseline set of example test cases.</Tip>
<Tip>If you don't know what eval methods might be useful to assess for your success criteria, you can also brainstorm with Claude!</Tip>

***

## Grading evals

When deciding which method to use to grade evals, choose the fastest, most reliable, most scalable method:

1. **Code-based grading**: Fastest and most reliable, extremely scalable, but also lacks nuance for more complex judgements that require less rule-based rigidity.
   - Exact match: `output == golden_answer`
   - String match: `key_phrase in output`

2. **Human grading**: Most flexible and high quality, but slow and expensive. Avoid if possible.

3. **LLM-based grading**: Fast and flexible, scalable and suitable for complex judgement. Test to ensure reliability first then scale.

### Tips for LLM-based grading
- **Have detailed, clear rubrics**: "The answer should always mention 'Acme Inc.' in the first sentence. If it does not, the answer is automatically graded as 'incorrect.'"
    <Note>A given use case, or even a specific success criteria for that use case, might require several rubrics for holistic evaluation.</Note>
- **Empirical or specific**: For example, instruct the LLM to output only 'correct' or 'incorrect', or to judge from a scale of 1-5. Purely qualitative evaluations are hard to assess quickly and at scale.
- **Encourage reasoning**: Ask the LLM to think first before deciding an evaluation score, and then discard the reasoning. This increases evaluation performance, particularly for tasks requiring complex judgement.

<section title="Example: LLM-based grading">

```python
import anthropic

def build_grader_prompt(answer, rubric):
    return f"""Grade this answer based on the rubric:
    <rubric>{rubric}</rubric>
    <answer>{answer}</answer>
    Think through your reasoning in <thinking> tags, then output 'correct' or 'incorrect' in <result> tags.""

def grade_completion(output, golden_answer):
    grader_response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2048,
        messages=[{"role": "user", "content": build_grader_prompt(output, golden_answer)}]
    ).content[0].text

    return "correct" if "correct" in grader_response.lower() else "incorrect"

# Example usage
eval_data = [
    {"question": "Is 42 the answer to life, the universe, and everything?", "golden_answer": "Yes, according to 'The Hitchhiker's Guide to the Galaxy'."},
    {"question": "What is the capital of France?", "golden_answer": "The capital of France is Paris."}
]

def get_completion(prompt: str):
    message = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=1024,
        messages=[
        {"role": "user", "content": prompt}
        ]
    )
    return message.content[0].text

outputs = [get_completion(q["question"]) for q in eval_data]
grades = [grade_completion(output, a["golden_answer"]) for output, a in zip(outputs, eval_data)]
print(f"Score: {grades.count('correct') / len(grades) * 100}%")
```

</section>

***

# Using the Evaluation Tool

The [Claude Console](/dashboard) features an **Evaluation tool** that allows you to test your prompts under various scenarios.

---

## Accessing the Evaluate Feature

To get started with the Evaluation tool:

1. Open the Claude Console and navigate to the prompt editor.
2. After composing your prompt, look for the 'Evaluate' tab at the top of the screen.

![Accessing Evaluate Feature](/docs/images/access_evaluate.png)

<Tip>
Ensure your prompt includes at least 1-2 dynamic variables using the double brace syntax: \{\{variable\}\}. This is required for creating eval test sets.
</Tip>

## Generating Prompts

The Console offers a built-in [prompt generator](/docs/en/build-with-claude/prompt-engineering/prompt-generator) powered by Claude Opus 4.1:

<Steps>
  <Step title="Click 'Generate Prompt'">
    Clicking the 'Generate Prompt' helper tool will open a modal that allows you to enter your task information.
  </Step>
  <Step title="Describe your task">
    Describe your desired task (e.g., "Triage inbound customer support requests") with as much or as little detail as you desire. The more context you include, the more Claude can tailor its generated prompt to your specific needs.
  </Step>
  <Step title="Generate your prompt">
    Clicking the orange 'Generate Prompt' button at the bottom will have Claude generate a high quality prompt for you. You can then further improve those prompts using the Evaluation screen in the Console.
  </Step>
</Steps>

This feature makes it easier to create prompts with the appropriate variable syntax for evaluation.

![Prompt Generator](/docs/images/promptgenerator.png)

## Creating Test Cases

When you access the Evaluation screen, you have several options to create test cases:

1. Click the '+ Add Row' button at the bottom left to manually add a case.
2. Use the 'Generate Test Case' feature to have Claude automatically generate test cases for you.
3. Import test cases from a CSV file.

To use the 'Generate Test Case' feature:

<Steps>
  <Step title="Click on 'Generate Test Case'">
    Claude will generate test cases for you, one row at a time for each time you click the button.
  </Step>
  <Step title="Edit generation logic (optional)">
    You can also edit the test case generation logic by clicking on the arrow dropdown to the right of the 'Generate Test Case' button, then on 'Show generation logic' at the top of the Variables window that pops up. You may have to click `Generate' on the top right of this window to populate initial generation logic.
    
    Editing this allows you to customize and fine tune the test cases that Claude generates to greater precision and specificity.
  </Step>
</Steps>

Here's an example of a populated Evaluation screen with several test cases:

![Populated Evaluation Screen](/docs/images/eval_populated.png)

<Note>
If you update your original prompt text, you can re-run the entire eval suite against the new prompt to see how changes affect performance across all test cases.
</Note>

## Tips for Effective Evaluation

<section title="Prompt Structure for Evaluation">

To make the most of the Evaluation tool, structure your prompts with clear input and output formats. For example:

```
In this task, you will generate a cute one sentence story that incorporates two elements: a color and a sound.
The color to include in the story is:
<color>
{{COLOR}}
</color>
The sound to include in the story is:
<sound>
{{SOUND}}
</sound>
Here are the steps to generate the story:
1. Think of an object, animal, or scene that is commonly associated with the color provided. For example, if the color is "blue", you might think of the sky, the ocean, or a bluebird.
2. Imagine a simple action, event or scene involving the colored object/animal/scene you identified and the sound provided. For instance, if the color is "blue" and the sound is "whistle", you might imagine a bluebird whistling a tune.
3. Describe the action, event or scene you imagined in a single, concise sentence. Focus on making the sentence cute, evocative and imaginative. For example: "A cheerful bluebird whistled a merry melody as it soared through the azure sky."
Please keep your story to one sentence only. Aim to make that sentence as charming and engaging as possible while naturally incorporating the given color and sound.
Write your completed one sentence story inside <story> tags.

```

This structure makes it easy to vary inputs (\{\{COLOR\}\} and \{\{SOUND\}\}) and evaluate outputs consistently.

</section>

<Tip>
Use the 'Generate a prompt' helper tool in the Console to quickly create prompts with the appropriate variable syntax for evaluation.
</Tip>

## Understanding and comparing results

The Evaluation tool offers several features to help you refine your prompts:

1. **Side-by-side comparison**: Compare the outputs of two or more prompts to quickly see the impact of your changes.
2. **Quality grading**: Grade response quality on a 5-point scale to track improvements in response quality per prompt.
3. **Prompt versioning**: Create new versions of your prompt and re-run the test suite to quickly iterate and improve results.

By reviewing results across test cases and comparing different prompt versions, you can spot patterns and make informed adjustments to your prompt more efficiently.

Start evaluating your prompts today to build more robust AI applications with Claude!

</section>

***

# Reducing latency

---

Latency refers to the time it takes for the model to process a prompt and and generate an output. Latency can be influenced by various factors, such as the size of the model, the complexity of the prompt, and the underlying infrastructure supporting the model and point of interaction.

<Note>
It's always better to first engineer a prompt that works well without model or prompt constraints, and then try latency reduction strategies afterward. Trying to reduce latency prematurely might prevent you from discovering what top performance looks like.
</Note>

---

## How to measure latency

When discussing latency, you may come across several terms and measurements:

- **Baseline latency**: This is the time taken by the model to process the prompt and generate the response, without considering the input and output tokens per second. It provides a general idea of the model's speed.
- **Time to first token (TTFT)**: This metric measures the time it takes for the model to generate the first token of the response, from when the prompt was sent. It's particularly relevant when you're using streaming (more on that later) and want to provide a responsive experience to your users.

For a more in-depth understanding of these terms, check out our [glossary](/docs/en/about-claude/glossary).

---

## How to reduce latency

### 1. Choose the right model

One of the most straightforward ways to reduce latency is to select the appropriate model for your use case. Anthropic offers a [range of models](/docs/en/about-claude/models/overview) with different capabilities and performance characteristics. Consider your specific requirements and choose the model that best fits your needs in terms of speed and output quality.

For speed-critical applications, **Claude Haiku 4.5** offers the fastest response times while maintaining high intelligence:

```python
import anthropic

client = anthropic.Anthropic()

# For time-sensitive applications, use Claude Haiku 4.5
message = client.messages.create(
    model="claude-haiku-4-5",
    max_tokens=100,
    messages=[{
        "role": "user",
        "content": "Summarize this customer feedback in 2 sentences: [feedback text]"
    }]
)
```

For more details about model metrics, see our [models overview](/docs/en/about-claude/models/overview) page.

### 2. Optimize prompt and output length

Minimize the number of tokens in both your input prompt and the expected output, while still maintaining high performance. The fewer tokens the model has to process and generate, the faster the response will be.

Here are some tips to help you optimize your prompts and outputs:

- **Be clear but concise**: Aim to convey your intent clearly and concisely in the prompt. Avoid unnecessary details or redundant information, while keeping in mind that [claude lacks context](/docs/en/build-with-claude/prompt-engineering/be-clear-and-direct) on your use case and may not make the intended leaps of logic if instructions are unclear.
- **Ask for shorter responses:**: Ask Claude directly to be concise. The Claude 3 family of models has improved steerability over previous generations. If Claude is outputting unwanted length, ask Claude to [curb its chattiness](/docs/en/build-with-claude/prompt-engineering/be-clear-and-direct).
  <Tip> Due to how LLMs count [tokens](/docs/en/about-claude/glossary#tokens) instead of words, asking for an exact word count or a word count limit is not as effective a strategy as asking for paragraph or sentence count limits.</Tip>
- **Set appropriate output limits**: Use the `max_tokens` parameter to set a hard limit on the maximum length of the generated response. This prevents Claude from generating overly long outputs.
  > **Note**: When the response reaches `max_tokens` tokens, the response will be cut off, perhaps midsentence or mid-word, so this is a blunt technique that may require post-processing and is usually most appropriate for multiple choice or short answer responses where the answer comes right at the beginning.
- **Experiment with temperature**: The `temperature` [parameter](/docs/en/api/messages) controls the randomness of the output. Lower values (e.g., 0.2) can sometimes lead to more focused and shorter responses, while higher values (e.g., 0.8) may result in more diverse but potentially longer outputs.

Finding the right balance between prompt clarity, output quality, and token count may require some experimentation.

### 3. Leverage streaming

Streaming is a feature that allows the model to start sending back its response before the full output is complete. This can significantly improve the perceived responsiveness of your application, as users can see the model's output in real-time.

With streaming enabled, you can process the model's output as it arrives, updating your user interface or performing other tasks in parallel. This can greatly enhance the user experience and make your application feel more interactive and responsive.

Visit [streaming Messages](/docs/en/build-with-claude/streaming) to learn about how you can implement streaming for your use case.
